# Comtanix Quote Request Manager

Senior Full Stack Developer Technical Assessment.

## 1. Project Overview

This project is a Quote Request Management system developed for the Comtanix technical assessment.

It allows clients to submit quote requests, while Admin and Staff users can manage those requests through a dashboard.

## 2. Tech Stack

- PHP / Laravel
- MySQL
- Node.js / Express
- MongoDB
- React / TypeScript
- Docker Compose

## 3. Project Structure

- `api-laravel/` — Main application API
- `audit-service/` — Independent event auditing service
- `frontend/` — Public quote form and Staff dashboard
- `docs/` — API documentation and technical notes
- `docker-compose.yml` — Database containers

## 4. Prerequisites

### 4.1 Required Software
Install Docker Desktop, PHP, Composer, Node.js, npm, and Git before setting up the project.

### 4.2 Required Versions
The project was developed using PHP 8.4 and MySQL 8.4. Use compatible Node.js and other dependency versions as specified in the project configuration files.

## 5. Project Setup

### Step 1 — Clone the Repository

Clone the GitHub repository and open the project folder.

```cmd
git clone https://github.com/Saim298/comtanix-fullstack-assessment-muhammad-saim.git
cd comtanix-fullstack-assessment-muhammad-saim
```

### Step 2 — Set Up Docker Desktop

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if it is not already installed, then open it and make sure Docker is running.

### Step 3 — Configure the Root Environment File

Copy the `.env.example` file to `.env` in the main project folder and update the MySQL and MongoDB credentials using your own local values.

```cmd
copy .env.example .env
```

### Step 4 — Start MySQL and MongoDB Containers

Run the following command from the main project folder to start both database containers.

```cmd
docker compose up -d
```

Check that both containers are running:

```cmd
docker compose ps
```

MySQL and MongoDB should now be available for the Laravel API and Node.js Audit Service.

### Step 5 — Set Up the Laravel API

Open a new terminal and go to the Laravel folder.

```cmd
cd api-laravel
```

#### 5.1 Install PHP Dependencies

Install all the required Laravel packages using Composer.

```cmd
composer install
```

#### 5.2 Configure Laravel `.env`

Copy the example environment file to create your local `.env` file.

```cmd
copy .env.example .env
```

Open `.env` and configure the MySQL connection:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=comtanix_quotes
DB_USERNAME=comtanix
DB_PASSWORD=your_mysql_password
QUEUE_CONNECTION=database
```

Make sure the database username and password match the values configured in the root Docker `.env` file.

Also configure the Audit Service connection and seeded account passwords using the variables provided in Laravel's `.env.example`.

Clear the configuration cache after updating the file.

```cmd
php artisan config:clear
```

#### 5.3 Generate the Application Key

Generate the Laravel application key.

```cmd
php artisan key:generate
```

#### 5.4 Run Database Migrations

Create the required MySQL database tables.

```cmd
php artisan migrate
```

#### 5.5 Seed Admin, Staff, and Sample Quote Requests

Run the database seeders to create one Admin, two Staff users, and approximately 200 sample quote requests.

```cmd
php artisan db:seed
```

#### 5.6 Start the Laravel Server

Start the Laravel API server.

```cmd
php artisan serve --host=127.0.0.1 --port=8000
```

The Laravel API will be available at:

`http://127.0.0.1:8000`

Keep this terminal running while using the application.

### Step 6 — Set Up the Node.js Audit Service

Open a new terminal and go to the Audit Service folder.

```cmd
cd audit-service
```

#### 6.1 Install Node.js Dependencies

Install the required Node.js packages.

```cmd
npm install
```

#### 6.2 Configure Audit Service `.env`

Create the environment file using the provided example.

```cmd
copy .env.example .env
```

Open `.env` and configure the MongoDB connection, server port, and audit security settings.

Use the variable names provided in `.env.example`. MongoDB runs through Docker on port `27018`, and the Audit Service runs on port `4001`.

Make sure the MongoDB username and password match the Docker configuration.

#### 6.3 Configure Matching Audit Secrets

Laravel and the Node.js Audit Service communicate using shared security values.

Set the same HMAC signing secret in both services. Also make sure the audit read token used by Laravel matches the token expected by Node.js.

Use your own secret values. Do not commit them to GitHub.

#### 6.4 Start the Audit Service

Run the following command:

```cmd
npm run dev
```

The Audit Service will run at:

`http://127.0.0.1:4001`

Keep this terminal running.

### Step 7 — Start the Laravel Queue Worker

Open another terminal and go to the Laravel folder.

```cmd
cd api-laravel
```

Start the database queue worker.

```cmd
php artisan queue:work database
```

The queue worker sends audit events from Laravel to the Node.js Audit Service.

If the Audit Service is temporarily unavailable, failed delivery attempts can be retried using the configured retry policy.

Keep this terminal running while using the application.

### Step 8 — Set Up the React Frontend

Open a new terminal and go to the frontend folder.

```cmd
cd frontend
```

#### 8.1 Install Frontend Dependencies

Install the required React packages.

```cmd
npm install
```

#### 8.2 Configure Frontend `.env`

Create the frontend environment file.

```cmd
copy .env.example .env
```

Open `.env` and make sure the API base URL is configured as:

```env
VITE_API_BASE_URL=/api
```

The Vite development server forwards API requests to Laravel running on port `8000`.

#### 8.3 Start the Frontend

Run the React development server.

```cmd
npm run dev
```

Open your browser and visit:

`http://localhost:5173`

The public quote request form is available at:

`http://localhost:5173/request-quote`

Staff and Admin users can log in at:

`http://localhost:5173/login`

After login, users can access the Quote Management dashboard.

`http://localhost:5173/dashboard`

Keep the frontend terminal running while using the application.

## 6. Application URLs

### 6.1 Public Quote Request Form

**URL:** http://localhost:5173/request-quote

Clients can submit their quote requests without creating an account or logging in.

### 6.2 Staff Login

**URL:** http://localhost:5173/login

Admin and Staff users can log in using their registered email and password.

### 6.3 Admin and Staff Dashboard

**URL:** http://localhost:5173/dashboard

After logging in, users can view quote requests, search, filter, sort, and manage them according to their roles.

### 6.4 Laravel API

**Base URL:** http://127.0.0.1:8000/api

The Laravel API handles authentication, quote requests, staff assignments, status changes, and communication with the Audit Service.

### 6.5 Node.js Audit Service

**Base URL:** http://127.0.0.1:4001

The Audit Service stores important quote events in MongoDB, such as new requests, assignments, and status changes. It communicates securely with Laravel and is not intended for direct public access.

## 7. Seeded Test Accounts

The project includes one Admin account and two Staff accounts for testing. These accounts are created when the Laravel database seeders are executed.

### 7.1 Admin Account

- **Email:** `admin@comtanix.test`
- **Role:** Admin
- **Password:** Set in the Laravel `.env` file.

The Admin can manage quote requests, assign Staff members, update statuses, and delete requests.

### 7.2 Staff Account 1

- **Email:** `staff1@comtanix.test`
- **Role:** Staff
- **Password:** Set in the Laravel `.env` file.

Staff members can view requests and update the status of requests assigned to them.

### 7.3 Staff Account 2

- **Email:** `staff2@comtanix.test`
- **Role:** Staff
- **Password:** Set in the Laravel `.env` file.

This second Staff account can be used to test different assignments and role permissions.

### 7.4 Test Password Setup

Open `api-laravel/.env` and set the passwords for the seeded accounts using the password variables provided in `.env.example`.

After setting the passwords, run:

```cmd
php artisan db:seed
```

You can now log in using the email addresses above and the passwords you configured.

**Note:** Use test passwords only. Do not upload real passwords or the `.env` file to GitHub.

## 8. Running Automated Tests

The project includes automated tests for Laravel, the Node.js Audit Service, and the React frontend. These tests help check that the main features are working correctly.

### 8.1 Laravel Tests

Open a terminal in the Laravel folder.

```cmd
cd api-laravel
php artisan test
```

This runs the Laravel tests for authentication, user permissions, quote management, validation, and audit integration.

### 8.2 Node.js Audit Service Tests

Open a new terminal in the Audit Service folder.

```cmd
cd audit-service
npm test
```

This checks features such as event validation, HMAC signatures, and duplicate event handling.

Make sure MongoDB is running and the test database configuration is set correctly before running these tests.

### 8.3 React Frontend Tests

Open a new terminal in the frontend folder.

```cmd
cd frontend
npm test
```

This runs the frontend tests for authentication, quote forms, filters, and other application logic.

### 8.4 TypeScript, Build, and Lint Checks

**Node.js Audit Service**

```cmd
cd audit-service
npm run typecheck
npm run build
```

These commands check TypeScript errors and build the Audit Service.

**React Frontend**

```cmd
cd frontend
npm run build
npm run lint
```

These commands check the frontend build, TypeScript compilation, and code quality.

All commands should be run from the main project folder in separate terminals.

## 9. API Documentation

The Postman collection for both the Laravel API and Node.js Audit Service is available here:

[Comtanix Postman Collection](docs/Comtanix.postman_collection.json)

This collection contains API requests that can be used to test the application.

### 9.1 Importing the Postman Collection

1. Open Postman.
2. Click **Import**.
3. Select `docs/Comtanix.postman_collection.json`.
4. Import the collection.
5. Configure the required URLs, tokens, and other variables before testing.

### 9.2 API Authentication

The Laravel API uses Laravel Sanctum for authentication.

Admin and Staff users log in with their email and password. After a successful login, Laravel returns a token that is used to access protected endpoints.

Public quote submissions do not require authentication.

The Node.js Audit Service uses HMAC-SHA256 signatures to verify incoming audit events. Audit history requests also require a separate read token.

### 9.3 Testing the Endpoints

Start the Laravel API, Node.js Audit Service, databases, and queue worker before testing.

Use the imported Postman collection to test login, public quote submission, quote listing, assignments, status changes, and audit history.

The collection also includes requests for testing the Node.js Audit Service.

Make sure the required authentication tokens and audit security values are configured before sending protected requests.

## 10. Architecture Overview

The application is divided into three main parts: the Laravel API, Node.js Audit Service, and React frontend.

Each part handles its own responsibilities.

### 10.1 How the Application Works

A client submits a quote request through the public React form.

Laravel validates the information and saves the request in MySQL.

Admin users can review requests and assign them to Staff members. Authorized users can update request statuses.

Important changes are sent to the Node.js Audit Service, which stores the audit history in MongoDB.

### 10.2 Laravel and MySQL

Laravel is the main backend of the application.

It handles user authentication, permissions, quote requests, assignments, and status changes.

MySQL stores users and quote request information.

Laravel also uses database-backed queued jobs to send audit events without making the main API request depend on the Audit Service being available.

### 10.3 Node.js Audit Service and MongoDB

The Audit Service is a separate application built with Node.js and Express.

It receives important events from Laravel, verifies their signatures, and stores them in MongoDB.

It also prevents duplicate events from being stored when the same event is delivered more than once.

### 10.4 React Frontend

The frontend is built using React and TypeScript.

It includes a public form where clients can submit quote requests without logging in.

Admin and Staff users have a separate dashboard where they can view and manage requests according to their permissions.

The dashboard supports searching, filtering, sorting, pagination, assignments, status updates, and audit history.

### 10.5 Communication Between Services

React communicates with Laravel through HTTP API requests.

Laravel stores application data in MySQL and dispatches queued jobs when important changes happen.

The queue worker sends signed audit events to the Node.js Audit Service.

The Audit Service verifies these events and stores them in MongoDB.

React retrieves audit history through Laravel instead of accessing the Audit Service directly.

This keeps the Audit Service's private credentials on the backend.

For more detailed implementation information, see [Technical Notes](docs/TECHNICAL_NOTES.md).

## 11. Part E — Architecture Questions

### Question 1: What happens if the Audit Service is down for 10 minutes? How does your design recover, and what would you add for production?

**Answer:**
If the Audit Service goes down, Laravel will still save quote requests and allow users to work normally. Audit events are handled separately through Laravel's database queue. The queued jobs use up to 9 attempts with increasing retry delays. When the Audit Service becomes available again, the worker can deliver the pending events. MongoDB stores each event using a unique event ID, so retrying the same event will not create duplicates. We also tested this behavior by stopping the Audit Service and restarting it.
For production, I would add queue monitoring, automatic worker management, alerts for failed jobs, and a transactional outbox to make event delivery more reliable. Jobs that use all their attempts would need to be investigated and retried.

### Question 2: How would your list endpoint and indexes behave with 5 million quote requests? What would you change?

**Answer:**
Currently, MySQL uses indexes on fields such as status, assigned user, service type, and creation date. These help with common filtering and sorting operations. With 5 million records, some queries could become slower, especially searches using partial text matching and pagination with large offsets. I would check query performance using EXPLAIN, improve indexes based on real usage, and consider cursor-based pagination for large datasets. I would also consider full-text search for faster searching and archiving older records when necessary.

### Question 3: Which security risks did you consider (public endpoint, token storage, event signing, replay attacks), and what did you do or leave out?

**Answer:**
The public quote endpoint could receive spam or invalid requests, so I used Laravel validation, rate limiting, and abuse protection. Laravel Sanctum handles authentication, while Policies control Admin and Staff permissions. The frontend keeps the login token in session storage and handles expired tokens. For production, I would consider secure HttpOnly cookies to reduce token exposure to JavaScript. Audit events use HMAC-SHA256 signatures with a shared secret. The Audit Service verifies signatures before accepting events. Unique event IDs also prevent the same event from being stored multiple times.

### Question 4: What did you cut or simplify because of the time limit, and what would you build next?

**Answer:**
I kept the frontend simple and used a database-backed queue rather than introducing Redis or additional infrastructure. I would add a transactional outbox, better queue monitoring, more concurrency and frontend integration tests, and automated deployment. I also kept the audit timeline simple by displaying actor IDs rather than building a separate system to resolve actor names.

## 12. Assumptions

While developing this project, I made a few assumptions based on the given requirements:

- Clients can submit quote requests without creating an account.
- Admin users can assign or reassign requests, change statuses, and delete requests.
- Budget will in range like from 0-2000 or 10000 above.

## 13. Known Limitations

The main functionality is complete, but there are some limitations:

- The Laravel queue worker needs to be started separately.
- Audit history may take a little time to update because events are processed in the background.
- The system does not use a transactional outbox, so there is a small possibility of losing an audit event during certain server failures.
- The audit timeline currently displays actor IDs instead of user names.
- More performance and concurrency testing would be needed before using the system in production.

## 14. Future Improvements

If I continue working on this project, I would improve the following areas:

- Add automatic queue worker management and monitoring.
- Add a transactional outbox for more reliable audit event delivery.
- Improve search and pagination for very large amounts of data.
- Add more frontend and concurrency tests.
- Set up automated deployment and CI/CD.

These improvements were left out because I wanted to focus on the main requirements within the given time.

## 15. AI Tools Usage

### 15.1 Tools Used

- ChatGPT
- VS Code Copilot

### 15.2 How AI Tools Were Used

I used ChatGPT when I needed help understanding or solving technical problems. For example, I needed to make sure that if the Node.js Audit Service stopped working, the main Laravel application would continue running normally without losing quote requests. ChatGPT helped me understand how to handle this using Laravel queues, retries, and backoff.

I also used AI to speed up basic frontend design creation. I have experience with React and can build the frontend myself, but using AI helped me save time during this assessment.

### 15.3 My Role in Development and Verification

My work included designing the application architecture, setting up the development environment, implementing backend functionality, integrating the database and Audit Service, and developing the frontend.

I worked with Laravel, MySQL, Node.js, MongoDB, and React to implement authentication, role-based access, quote management, status workflows, and audit event processing.

For verification, I used Postman and Thunder Client to test API endpoints, tested the application through the browser, and ran automated tests to check functionality and reliability.

I also tested failure scenarios, including temporarily stopping the Node.js Audit Service, to verify that Laravel continued processing quote requests and that pending audit events could be delivered after recovery.
