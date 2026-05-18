FROM node:20-alpine

WORKDIR /workspace

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["yarn", "dev", "--hostname", "0.0.0.0"]
