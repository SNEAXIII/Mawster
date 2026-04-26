FROM nginx:alpine
COPY static-assets/static/ /usr/share/nginx/html/static/
COPY static-assets/nginx.conf.template /etc/nginx/templates/default.conf.template
