FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json to the container
COPY package.json yarn.lock ./
# Install dependencies

# Copy the rest of the project files to the container
COPY . .

# Build the project
RUN yarn install --production --frozen-lockfile
RUN yarn global add @nestjs/cli
RUN yarn run build

# Specify the command to run when the container starts
CMD ["node", "--max-old-space-size=300", "dist/main.js"]

# Expose port 3001 for the application to listen on
EXPOSE 3001