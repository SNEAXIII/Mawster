FROM alpine:3.19

RUN apk add --no-cache \
    mariadb-client \
    rclone \
    bash \
    tzdata \
    jq

COPY --chown=root:root --chmod=600 crontab /etc/crontabs/root
COPY --chown=root:root --chmod=555 backup.sh restore.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh

CMD ["crond", "-f", "-l", "2"]
