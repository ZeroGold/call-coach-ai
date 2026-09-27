# Call Coach as a website. Visitors bring their own TypeSafe key (entered in
# Settings) and speech is transcribed in their browser, so this image skips the
# server-side speech libraries and stays small.
#
#   docker build -t call-coach .
#   docker run -p 8080:8080 call-coach
#
# Options (as environment variables):
#   ACCESS_CODE=...         let people use this server's TYPESAFE_API_KEY if they enter this code
#   TYPESAFE_API_KEY=...    the server's key (only used with ACCESS_CODE or OPEN_ACCESS=1)
#   RATE_LIMIT_PER_MINUTE   evaluations per visitor per minute (default 30)
#   TRUST_PROXY=1           behind a load balancer, rate-limit by the X-Forwarded-For address

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOSTED=1 PORT=8080 TRUST_PROXY=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
COPY server.mjs ./
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
