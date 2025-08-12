# 📌 Collaborative Project Management Tool

The **backend** of the Collaborative Project Management Tool powers the web platform with **RESTful APIs**, handling authentication, data storage, business logic, and secure communication between the frontend and database. It is built with **Node.js** and **Express**, using **Supabase PostgreSQL** as the main database.


---

## 🌟 Features

- **Projects & Tasks**: Create projects, set milestones, assign tasks, priorities, deadlines, and required skills.
- **Dashboards & Charts**: Real‑time progress, completion %, workload heatmaps, and reports.
- **Collaboration**: Comments per task, mentions, and file attachments.
- **Notifications**: Email + in‑app alerts for assignments, changes, and deadlines.
- **RBAC Security**: Role‑based access for **Admin**, **Manager**, **Member**, **Client**.
- **AI Suggestions**: Recommend assignees based on skills, workload, and past performance.
- **Calendar Sync**: (Optional) One‑way Google Calendar integration for deadlines.

---

## 🧱 Tech Stack

| Layer | Tech |
|------|------|
| Runtime | Node.js |
| Framework | Express |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (email+password) |
| Realtime/Chat | Socket.IO |
| Email | Nodemailer (SMTP) |
| Hosting | Render (backend), Supabase (DB/Auth/Storage) |

---

## 📂 Project Structure
```
backend/
backend/
|-- src/
|   |-- config/         
|   |-- controllers/   
|   |-- routes/         
|   |-- middleware/     
|   |-- services/         
|   |-- server.js       # Main Express app
|-- .env                # Environment variables
|-- package.json        # Dependencies & scripts
|-- README.md           # Documentation
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/Project-Nexync/ProjectManagementTool-Backend.git
cd ProjectManagementTool-Backend
```
### 2️⃣ Install dependencies
```bash
npm install
```
### 3️⃣ Create .env file
```bash
PORT=5000
DATABASE_URL=<supabase_postgresql_connection_string>
JWT_SECRET=<your_secret>
```
### 4️⃣ Run the server
```bash
node server.js
```
The backend will now be running at:  **http://localhost:3000**
