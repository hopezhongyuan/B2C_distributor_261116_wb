# B2C 分销服务端镜像（生产）
FROM docker.m.daocloud.io/library/node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3000
CMD ["node", "src/app.js"]
