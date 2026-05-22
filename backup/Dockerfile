FROM alpine:3.19

RUN apk add --no-cache mariadb-client rclone tzdata bash

COPY --chown=root:root --chmod=555 backup.sh restore.sh run.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/run.sh

RUN addgroup -S backup && adduser -S backup -G backup

USER backup

CMD ["sh", "/usr/local/bin/run.sh"]
