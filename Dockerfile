FROM node:lts AS runtime
WORKDIR /app

# COPY . /app
ADD . /app

ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD npm install && npx astro dev --host 0.0.0.0