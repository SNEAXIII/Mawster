FROM alpine:3.19

RUN apk add --no-cache \
    mariadb-client \
    rclone \
    bash \
    tzdata \
    jq

COPY crontab /etc/crontabs/root
COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

CMD ["crond", "-f", "-l", "2"]
