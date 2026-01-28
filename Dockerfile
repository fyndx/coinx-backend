FROM oven/bun:latest as base
WORKDIR /app

# Copy dependencies
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN bunx prisma generate

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 3000

# Run the application
CMD ["bun", "run", "start"]
