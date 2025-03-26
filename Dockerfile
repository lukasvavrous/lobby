FROM node:18-alpine

WORKDIR /app

# Zkopíruj package.json a package-lock.json a nainstaluj závislosti
COPY package*.json ./
RUN npm install

# Zkopíruj celý kód
COPY . .

# Přidej entrypoint skript a nastav práva
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Exponuj porty pro React (3000) a backend (5000)
EXPOSE 3000 5000

CMD ["/app/entrypoint.sh"]
