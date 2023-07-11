FROM node:lts AS runtime
WORKDIR /app

EXPOSE 3000

CMD yarn && yarn dev --host
