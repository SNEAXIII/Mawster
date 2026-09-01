import aioboto3
from botocore.config import Config
from botocore.exceptions import ClientError

from src.security.secrets import SECRET
from src.storage.base import ObjectStat, Storage


def _is_missing(exc: ClientError) -> bool:
    """Whether a botocore error means "no such object".

    Three shapes because a HEAD carries no body: S3 answers `404` with an empty
    error code, RustFS answers `NoSuchKey`, and some paths only fill in the HTTP
    status. Checking one of the three was the bug this helper exists to prevent.
    """
    error = exc.response.get("Error", {})
    return (
        error.get("Code") in ("NoSuchKey", "NotFound", "404")
        or exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 404
    )


class S3Storage(Storage):
    """S3-compatible storage backed by RustFS.

    A new client is opened per call: aioboto3 clients are bound to the running
    event loop, and a long-lived one would break across FastAPI's worker loops.
    """

    def __init__(self) -> None:
        self._session = aioboto3.Session()

    # Sign with SigV4. Botocore otherwise falls back to SigV2 against a custom
    # endpoint, which is long deprecated and which RustFS rejects outright on
    # some request shapes.
    _CONFIG = Config(signature_version="s3v4")

    def _client(self):
        return self._session.client(
            "s3",
            endpoint_url=SECRET.RUSTFS_ENDPOINT,
            aws_access_key_id=SECRET.RUSTFS_ACCESS_KEY,
            aws_secret_access_key=SECRET.RUSTFS_SECRET_KEY,
            config=self._CONFIG,
        )

    def _public_client(self):
        """Same credentials, but bound to the endpoint the browser will call.

        Separate from `_client` because SigV4 signs the Host header: a URL signed
        against the internal `http://rustfs:9000` is rejected with
        SignatureDoesNotMatch as soon as a browser sends it to the public name.
        Only ever used to *sign* — no request is issued through it.
        """
        return self._session.client(
            "s3",
            endpoint_url=SECRET.RUSTFS_PUBLIC_ENDPOINT,
            aws_access_key_id=SECRET.RUSTFS_ACCESS_KEY,
            aws_secret_access_key=SECRET.RUSTFS_SECRET_KEY,
            config=self._CONFIG,
        )

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        async with self._client() as client:
            await client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)

    async def get_bytes(self, bucket: str, key: str) -> bytes:
        async with self._client() as client:
            response = await client.get_object(Bucket=bucket, Key=key)
            return await response["Body"].read()

    async def presigned_put_url(
        self, bucket: str, key: str, content_type: str, expires_in: int
    ) -> str:
        async with self._public_client() as client:
            # ContentType is part of the signature, so the browser MUST send the
            # same value back as a Content-Type header. That is the only upload
            # constraint a presigned PUT can carry — size is not signable this
            # way, which is why commit_import re-checks it against the stored
            # object rather than trusting the client.
            return await client.generate_presigned_url(
                "put_object",
                Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
                ExpiresIn=expires_in,
            )

    async def stat_object(self, bucket: str, key: str) -> ObjectStat | None:
        async with self._client() as client:
            try:
                response = await client.head_object(Bucket=bucket, Key=key)
            except ClientError as exc:
                if _is_missing(exc):
                    return None
                raise
            return ObjectStat(
                size=response["ContentLength"],
                content_type=response.get("ContentType"),
            )

    async def get_head_bytes(self, bucket: str, key: str, length: int) -> bytes:
        async with self._client() as client:
            # Range is inclusive on both ends, hence length - 1.
            response = await client.get_object(
                Bucket=bucket, Key=key, Range=f"bytes=0-{length - 1}"
            )
            return await response["Body"].read()

    async def delete_prefix(self, bucket: str, prefix: str) -> None:
        async with self._client() as client:
            continuation_token = None
            while True:
                kwargs = {"Bucket": bucket, "Prefix": prefix}
                if continuation_token is not None:
                    kwargs["ContinuationToken"] = continuation_token
                response = await client.list_objects_v2(**kwargs)
                keys = [{"Key": obj["Key"]} for obj in response.get("Contents", [])]
                if keys:
                    await client.delete_objects(Bucket=bucket, Delete={"Objects": keys})
                if not response.get("IsTruncated"):
                    break
                continuation_token = response.get("NextContinuationToken")
