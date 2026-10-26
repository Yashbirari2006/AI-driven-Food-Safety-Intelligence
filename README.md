AI-Driven Food Safety Intelligence
Risk Prediction · Complaint Management · SLA-Aware Enforcement
A full-stack academic project exploring how digital complaint workflows, explainable risk prioritisation, and traceable case management can support food-safety operations.


React + TypeScript · Node.js + Express · PostgreSQL + Prisma · Python + scikit-learn


Overview · Architecture · Features · ML approach · Setup

📌 Overview
Food-safety complaints can contain different levels of urgency, incomplete information, and supporting photographs. A useful digital workflow should help a citizen submit a complaint, allow an authorised officer to review it, preserve status changes, and make risk-related information visible without treating an automated prediction as a final regulatory decision.

AI-Driven Food Safety Intelligence is a full-stack B.Tech project designed around that workflow. It combines a role-based web application, a PostgreSQL data layer, and a separate Python machine-learning service.

Project status: This is an evolving academic project. The complaint-management foundation and synthetic-data ML experiments are implemented. Some modules shown in the long-term workflow—such as complete inspection, laboratory, enforcement, and SLA escalation journeys—may still require implementation and end-to-end validation.

🎯 Problem statement
A complaint-management workflow needs to support:

Structured submission of food-safety concerns by citizens.
Clear visibility of complaint status after submission.
A queue through which authorised officers can review cases.
Traceable changes to important complaint records.
A consistent way to experiment with risk prioritisation.
A design that can grow towards inspection, laboratory, and service-level workflows.
The project explores how these needs can be connected in one system. It does not replace a food-safety authority, laboratory testing, or an officer's professional judgement.

💡 Project objectives
Build a web-based complaint submission and tracking experience.
Separate citizen and officer capabilities using authentication and role-based access.
Store application data in PostgreSQL using Prisma.
record important workflow actions through audit logging.
Develop and evaluate an initial Low / Medium / High risk-classification model using clearly identified synthetic data.
Keep AI predictions advisory, with human review remaining part of the workflow.
Create a maintainable foundation for future inspection, sample-tracking, and SLA features.
✨ Features
Implemented foundation
Area	What it supports
Authentication	Registration/login foundation using token-based authentication.
Role-aware access	Citizen and food-safety-officer roles are used to separate views and actions.
Complaint submission	Citizens can submit a complaint through the web interface.
Citizen dashboard	Citizens can view their own complaints and track status.
Officer queue	Officers can access the complaint-review queue.
Complaint review	An eligible submitted complaint can be moved to Under Review.
Audit trail	Complaint status changes are recorded as audit actions.
Complaint photos	A photo upload/display flow has been implemented for complaint evidence.
ML experiment	A synthetic dataset has been audited and used for an initial Random Forest experiment.
Planned / requiring further validation
Complete inspection assignment and inspection reporting.
Sample collection, chain-of-custody tracking, and laboratory result workflows.
SLA timers, breach detection, escalation, and supervisor views.
Full production-grade ML inference integration and model lifecycle management.
Comprehensive automated tests, deployment, monitoring, and security hardening.
Feature availability can change as development continues. Check the current code and project issues before relying on a feature in a live setting.

🧭 End-to-end workflow
The diagram below shows the intended user journey. The AI risk assessment is advisory; it does not automatically decide enforcement action.

flowchart TD
    A([Citizen]) --> B[Submit complaint]
    B --> C[Validate request and evidence]
    C --> D[(PostgreSQL database)]
    D --> E[Complaint appears in citizen dashboard]
    D --> F[Officer review queue]

    C -. Optional advisory assessment .-> G[Risk classification service]
    G -. Risk estimate and supporting factors .-> F

    F --> H[Officer reviews complaint]
    H --> I[Update complaint status]
    I --> J[Record audit action]
    J --> K[Citizen tracks status]

    H -. Future workflow .-> L[Inspection]
    L -. Future workflow .-> M[Sample and laboratory process]
    M -. Future workflow .-> N[Enforcement and SLA monitoring]

    classDef user fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e
    classDef app fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef data fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef future fill:#f3e8ff,stroke:#9333ea,color:#581c87
    class A user
    class B,C,E,F,H,I,K app
    class D,J data
    class L,M,N future
How to read it

A citizen submits a complaint and supporting information.
The application stores the complaint and makes it available in the relevant views.
An officer reviews the case and updates its status.
The change is recorded for traceability, and the citizen can see the updated status.
Risk classification may support prioritisation, but it must not replace human review.
🏗️ System architecture
The application is organised into separate layers so that the UI, API, database, and ML experiment can be developed and tested independently.

flowchart LR
    U[Citizen / Officer] --> FE[React + TypeScript<br/>Vite frontend]
    FE <-->|HTTP REST API| API[Node.js + Express<br/>TypeScript backend]
    API <--> ORM[Prisma ORM]
    ORM <--> DB[(PostgreSQL)]

    API -. Prediction request<br/>where configured .-> ML[Python ML service<br/>FastAPI + scikit-learn]
    ML --> OUT[Risk category<br/>Low / Medium / High]
    OUT -. Advisory output .-> API

    API --> AUD[Audit actions]
    AUD --> DB

    classDef frontend fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef backend fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef storage fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef ml fill:#f3e8ff,stroke:#9333ea,color:#581c87
    class FE frontend
    class API,ORM backend
    class DB,AUD storage
    class ML,OUT ml
Integration note: The diagram describes the intended service boundary. Do not assume the ML service, saved model artefact, and backend prediction endpoint are all available end-to-end on every machine without completing the setup and health checks described below.

🧰 Technology stack
Layer	Technology	Responsibility
Frontend	React, TypeScript, Vite	User interface and dashboards
API	Node.js, Express, TypeScript	Authentication and application workflows
ORM	Prisma	Database schema and data access
Database	PostgreSQL	Users, complaints, evidence metadata, and workflow records
ML service	Python, FastAPI, scikit-learn	Risk-classification experiment and service boundary
Model	Random Forest classifier	Initial Low / Medium / High classification experiment
Data tooling	Python, CSV, pandas/scikit-learn	Dataset generation, audits, training, and evaluation
Version control	Git and GitHub	Source control and collaboration
🧠 AI and machine learning
Dataset
The initial dataset is synthetically generated, not a collection of verified real-world complaints. It is used to build and test the ML workflow, not to claim operational performance.

Item	Current experiment
Records	15,000 synthetic records
Training split	12,000 records
Test split	3,000 records
Target	Risk level
Classes	Low, Medium, High
Model	Random Forest classifier
Data limitation	Labels were generated using predefined rules; this can make evaluation optimistic relative to real cases.
Initial evaluation
Metric	Reported result
Accuracy	96.53%
Balanced accuracy	97.12%
Macro F1-score	95.79%
These metrics describe the model's performance on the project's synthetic test split only. Because synthetic labels follow generated rules, the results do not establish accuracy on real complaints and should not be used as evidence of real-world food-safety detection capability.

Responsible use
Treat model output as decision support, not an official finding.
Keep human review in the loop.
Do not infer contamination or legal violations from a prediction alone.
Validate on representative, appropriately labelled real-world data before making real-world performance claims.
Record dataset provenance, feature definitions, split strategy, metrics, and known limitations.
Never present synthetic records as official data from FSSAI or another authority.
🗂️ Repository structure
The tree below highlights the main areas of the repository. Exact files may evolve as the project grows.

AI-driven-Food-Safety-Intelligence/
│
├── frontend/                    # React + TypeScript + Vite application
│   ├── src/
│   │   ├── components/          # Shared UI components
│   │   ├── pages/               # Citizen and officer screens
│   │   └── ...                  # API helpers, types, styles, app entry
│   ├── public/                  # Static frontend assets
│   ├── package.json             # Frontend scripts and dependencies
│   └── .env                     # Local frontend environment (not committed)
│
├── backend/                     # Express + TypeScript API
│   ├── prisma/                  # Prisma schema and migrations
│   ├── controllers/             # Request-handling logic
│   ├── routes/                  # API route definitions
│   ├── middleware/              # Authentication and access checks
│   ├── scripts/                 # Development/maintenance scripts
│   └── package.json             # Backend scripts and dependencies
│
├── ml-service/                  # Python ML service and experiments
│   ├── app.py                   # FastAPI service entry point
│   ├── generate_dataset.py      # Synthetic dataset generation
│   ├── audit_dataset.py         # Dataset quality checks
│   ├── audit_label_rules.py     # Label/feature relationship audit
│   ├── train_model.py           # Model training and evaluation
│   └── inspect_model.py         # Model inspection utilities
│
├── data/
│   ├── generated/               # Synthetic datasets and metadata
│   └── reports/                 # Audit, evaluation, and model reports
│
├── .gitignore
└── README.md
Directory guide

frontend/ — pages and UI used by citizens and officers.
backend/ — API endpoints, authentication, complaint workflows, and database access.
backend/prisma/ — database schema and migration history.
ml-service/ — Python service and scripts for dataset audit and model evaluation.
data/generated/ — generated datasets and data documentation.
data/reports/ — evaluation outputs such as metric summaries and confusion matrices.
Large local artefacts (for example, virtual environments, uploaded files, secrets, and the trained model binary) may be excluded from Git. A fresh clone may therefore require local setup or model regeneration.

🔐 Security and data handling
Keep credentials and signing secrets in local environment files; never commit them.
Use authentication and role checks for protected operations.
Validate uploaded data and request payloads on the server.
Restrict access to complaint evidence and uploaded files.
Avoid placing real citizens' personal information in test data or screenshots.
Use audit records to help trace sensitive workflow changes.
Before deployment, review CORS, token expiry, upload limits, file validation, rate limiting, logging, and database permissions.
This list describes important safeguards and review areas; it is not a claim that the application has completed a production security audit.

⚙️ Local development setup
Prerequisites
Install the following before starting:

Git
Node.js and npm
PostgreSQL
Python 3.10+ (use the version supported by the ML service dependencies)
A terminal such as PowerShell
1. Clone the repository
git clone https://github.com/Yashbirari2006/AI-driven-Food-Safety-Intelligence.git
cd AI-driven-Food-Safety-Intelligence
2. Configure PostgreSQL
Create a local PostgreSQL database (the development database has been referred to as food_safety_db). Configure the backend connection string in the backend's local environment file according to the variable names used in the backend configuration.

Do not copy a real password into this README or commit .env files. Check backend/.env.example if present; otherwise inspect the backend configuration to identify the required variable names.

3. Install and start the backend
cd backend
npm install
Create/configure the backend environment file, then apply the project's Prisma migrations using the scripts available in backend/package.json. Start the backend using the repository's configured development script, for example:

npm run dev
Run commands from the backend/ directory. If the script name differs in your checkout, use npm run to list the available scripts.

4. Install and start the frontend
Open a second terminal from the repository root:

cd frontend
npm install
Create frontend/.env with the API base URL used by the frontend:

VITE_API_BASE_URL=http://localhost:5000
Start the development server:

npm run dev
Vite prints the local frontend address in the terminal. Open that address in a browser.

5. Set up the ML service (when testing ML features)
Open a third terminal:

cd ml-service
python -m venv .venv
Activate the virtual environment in PowerShell:

.\.venv\Scripts\Activate.ps1
Install the Python dependencies listed in the service's dependency file (if provided). If the repository does not contain a dependency file yet, identify and pin the packages used by app.py and the training scripts before setting up a clean environment.

The trained model binary may not be tracked by Git because of its size. If it is absent locally, follow the training script's documented instructions to recreate it before testing prediction endpoints.

Startup checklist
 PostgreSQL is running and the configured database exists.
 Backend environment variables are set.
 Prisma migrations have been applied.
 Backend starts without errors.
 Frontend API base URL points to the running backend.
 Frontend starts without errors.
 ML dependencies and model artefact are available if testing ML endpoints.
 Login, role-protected routes, complaint submission, status updates, and photo display are manually verified in the local environment.
🔌 API overview
The following endpoints have been used in the application. Check the current route files for request bodies, authentication requirements, response formats, and any changes.

Method	Endpoint	Purpose
POST	/api/auth/register	Register a user
POST	/api/auth/login	Authenticate a user
POST	/api/complaints	Submit a complaint
GET	/api/complaints/my	List the authenticated citizen's complaints
GET	/api/complaints/officer/queue	Retrieve the officer review queue
PATCH	/api/complaints/:id/status*	Update complaint status, where supported by the current route
POST / GET	/api/ai/predict*	AI prediction route; verify method and payload in current route definitions
* Route names and methods can change during development. Confirm them in backend/ before using them in a client or external integration. Protected endpoints require the appropriate authentication token and role.

🧪 Testing and verification
When validating a local checkout, test each layer separately and then test the complete journey:

Backend: confirm it starts and connects to PostgreSQL.
Authentication: register/log in and confirm protected endpoints reject requests without a valid token.
Citizen journey: submit a complaint, refresh the page, and confirm the complaint remains visible.
Officer journey: sign in as an authorised officer, open the queue, and update an eligible complaint.
Auditability: confirm the status change produces the expected audit record.
Evidence: upload a complaint photo, refresh, and confirm it can be retrieved by an authorised view.
ML service: check service health, load the model, and verify the prediction response and input validation.
Evaluation: rerun the dataset audit and model evaluation when data, features, labels, or training code change.
A successful result in one layer does not automatically prove that the entire system is production-ready.

🚧 Limitations and future work
Current limitations
The initial ML dataset is synthetic and rule-labelled.
Reported ML metrics are not real-world validation metrics.
Some operational workflows are planned or require additional end-to-end testing.
The project is an academic system and has not been established as a production regulatory platform.
No official FSSAI system integration is claimed.
Potential next steps
Complete inspection assignment and officer reporting.
Add sample collection, chain-of-custody, and laboratory result workflows.
Implement configurable SLA deadlines, breach alerts, and escalation history.
Add automated unit, API, and end-to-end tests.
Improve dataset documentation and evaluate against independently labelled, representative data when legitimately available.
Add deployment configuration, observability, backups, and a documented security review.
Improve accessibility, responsive behaviour, and operational error handling.
🤝 Contributing
Contributions and review suggestions are welcome.

Create a feature branch.
Make a focused change.
Run the relevant checks.
Describe the change and how it was tested in the pull request.
Do not include credentials, personal complaint data, uploaded evidence, or large generated artefacts unless intentionally approved for version control.
⚖️ Disclaimer
This project is developed for academic and software-engineering learning purposes. It is not an official FSSAI product and does not claim integration with official government systems. Risk predictions are experimental and advisory; they must not be treated as proof of contamination, a legal finding, or an automated enforcement decision.

Built as a B.Tech project exploring responsible AI-assisted food-safety workflows.
