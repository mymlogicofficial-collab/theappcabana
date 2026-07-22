FROM node:18-alpine

# Install FFmpeg and other dependencies
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p /app/src/public/uploads
EXPOSE 5000
CMD ["npm", "start"]

