#Use the official Node.js image as a base
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

#Copy package.json and package-lock.json to the working directory
COPY package*.json ./

#Install dependencies
RUN npm install --production

#Copy rest of the application code to the working directory
COPY . .

#Expose the port app runs on
EXPOSE 8000

#start the application
CMD ["npm", "start"]