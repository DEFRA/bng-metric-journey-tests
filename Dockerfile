FROM node:26.8.1-slim

ENV TZ="Europe/London"

USER root

RUN apt-get update -qq \
    && apt-get install -qqy \
    curl \
    unzip

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install

WORKDIR /app

COPY . .
# --ignore-scripts blocks preinstall/install/postinstall/prepare for this package and
# every dependency (belt-and-braces with .npmrc's ignore-scripts=true) — the mechanism
# behind npm supply-chain worms (e.g. Shai-Hulud) that execute code at install time.
RUN npm install --ignore-scripts
# Install Playwright's bundled Chromium and its OS dependencies
RUN npx playwright install --with-deps chromium

ENTRYPOINT [ "./entrypoint.sh" ]

# This is downloading the linux amd64 aws cli. For M1 macs build and run with the --platform=linux/amd64 argument. eg docker build . --platform=linux/amd64
