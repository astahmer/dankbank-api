FROM golang:1-alpine

RUN apk add git
RUN cd /go && \
    go get -u github.com/FiloSottile/mkcert && \
    cd src/github.com/FiloSottile/mkcert && \
    go build -o /bin/mkcert

WORKDIR /root/.local/share/mkcert

CMD mkcert -install && for i in $(echo $DOMAINS | sed "s/,/ /g"); do mkcert $i; done && tail -f -n0 /etc/hosts