
# Cognivio

The app is an AI driven school health and wellness platform. It helps the school industry by helping kids manage their mental health , eating habit and overall lifestyle.

The web app helps teachers and school admins to obtain valuable insights on student's eating habits and overall mental wellbeing. Teachers can use this web app to identify possible diffic
ulties early, understand student need and give appropriate support.

The app seeks to establish a healthier and encouraging school atmosphere where student health, wellbeing and good eating habits are supported and prioritized by bringing teachers, school admins and student to a single platform.


## Features

- Student wellbeing tracking
- Eating habit and lifestyle tracking
- Teacher wellbeing dashboard
- School administrator dashboard
- AI-powered wellbeing insights
- Identification of potential concerning patterns
- Student progress and history
- Role-based access for students, teachers, and administrators
- Data visualization and statistics

 ## How It Works

1. Students provide information about their wellbeing and lifestyle.
2. Cognivio organizes and analyzes the collected information.
3. AI identifies relevant patterns and generates insights.
4. Teachers and administrators can view appropriate insights through their dashboards.
5. Educators can use these insights to better understand student needs and provide
   appropriate support.

> Cognivio is designed to support educators and students, not to diagnose
> medical or psychological conditions.

## Screenshots

### Student Dashboard

<img width="1800" height="996" alt="Screenshot 2026-08-21 at 11 58 34 PM" src="https://github.com/user-attachments/assets/3ec71e4e-4c80-46b6-b104-b9bb1ac11923" />


### Teacher Dashboard

<img width="1800" height="1001" alt="Screenshot 2026-08-22 at 12 02 41 AM" src="https://github.com/user-attachments/assets/92f18f73-f3b2-46bc-837e-c7fc04e15585" />

### Admin Dashboard

<img width="1800" height="1000" alt="Screenshot 2026-08-22 at 12 03 58 AM" src="https://github.com/user-attachments/assets/22b31e23-9c07-4795-a391-4748aad04101" />

### Health Monitor Dashboard

<img width="1731" height="1130" alt="Screenshot 2026-08-22 at 12 01 29 AM" src="https://github.com/user-attachments/assets/f71228e1-11b3-4105-8e98-2916530631fa" />

Demo:

Web app on vercel: https://cognivio-nu.vercel.app/    (For some reason the ai chatbox dosen't work in vercel but it works through local deployment and using your own api key)

Demo video: https://canva.link/l4tsh1mpvtufpqv

## Running Locally

### Step 0: Download the prerequisites

Make sure you have the following installed:

- Node.js
- npm

### Step 1: Clone the repository

```bash
git clone https://github.com/shanealexshibu1-crypto/Cognivio.git
cd Cognivio
```
### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Configure environment variables

Create a file named .env in the root folder and paste your API key (from OpenRouter or your favorite provider).

```bash
api_key=YOUR_API_KEY_HERE
url_api_key=https://openrouter.ai/api/v1
```

I used open router cause it is monstly free and unlimited

### Step 4: Start the development server
```bash
npm run dev
```
