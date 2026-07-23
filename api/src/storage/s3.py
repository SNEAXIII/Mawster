import aioboto3
from botocore.config import Config

from src.security.secrets import SECRET
from src.storage.base import Storage


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

    async def put_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        async with self._client() as client:
            await client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)

    async def get_bytes(self, bucket: str, key: str) -> bytes:
        async with self._client() as client:
            response = await client.get_object(Bucket=bucket, Key=key)
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
