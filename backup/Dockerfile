FROM alpine:3.19

RUN apk add --no-cache \
    mariadb-client \
    rclone \
    bash \
    tzdata \
    jq

COPY --chown=root:root --chmod=555 backup.sh restore.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh

RUN addgroup -S backup && adduser -S backup -G backup \
    && mkdir -p /var/log \
    && touch /var/log/backup.log \
    && chown backup:backup /var/log/backup.log

COPY --chown=backup:backup --chmod=600 crontab /etc/crontabs/backup

USER backup

CMD ["crond", "-f", "-l", "2"]
