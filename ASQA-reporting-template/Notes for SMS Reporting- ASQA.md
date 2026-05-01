# **Notes for SMS Reporting**

**(ProSMS, Australia)**

## **ASQA Reporting**

- There are **3 sheets in ASQA Reporting** (Given by the client) - (Ref: [delivery_data_and_student_survey_data_template.xlsx](https://docs.google.com/spreadsheets/d/16M2MgTRLERrEl2PHWhpss3oqyswSYRjF/edit?usp=sharing&ouid=101843401402237740743&rtpof=true&sd=true))
  এগুলো মূলত **ASQA compliance reporting template.**
  - Delivery Data Summary
  - Student Survey Data (এই sheet টা **AVETMISS** standard এর সাথে aligned)
  - Enrollment and Completion Data
- ASQA template static নয়। Audit type অনুযায়ী change হতে পারে।
- **Question: "Student Survery Data"** শিট এ যেই মেসেজ টা উপরে দেয়া আছে আমি সেটা একটু বুঝতে চাইঃ
  _“Instructions: Provide details below for all students who have enrolled and/or have completed any training product in the past 12 months - where this is less than 1000 unique students.
  Where your RTO has had more than 1000 enrolments or completions in the past 12 months, please provide a sample across all training products on your scope where enrolments of completions have occured to equal 1000 unique students (to ensure sample is random, please populate the sample by selecting students with a surname starting with A to Z - to achieve the desired number for each training program)
  Unique student means each student listed below is unique - as we only want to send them one survey invite. For example, if one student has enrolled and/or completed two different training products with your organisation in the past 12 months, that student should only be listed once below against one of the training products. To assist in identifying if student details are unique, Column E (Mobile number) and Column H (student email address) and will highlight red if duplicate values are identified.”_
  - **Answer:**
    - **Part 1:** Provide details below for all students who have enrolled and/or have completed any training product in the past 12 months - where this is less than 1000 unique students.
      **Meaning:**
      Jodi last 12 months e:
      **\*\*** Total unique students **1000 er kom hoy**Tahole:
      👉 Shob student ke list korte hobe
      (enrolled OR completed – duitar jekono ekta holeo include hobe)
      **Example:**Last 12 months e:
      **\*\*** 420 students enrolled
      **\*\*** 380 completed
      **\*\*** Unique student = 550
      👉 Tahole 550 jon ke full list korte hobe.
    - **Part 2:** Where your RTO has had more than 1000 enrolments or completions in the past 12 months…
      **Meaning:**Jodi 1000 er beshi unique student thake last 12 months e
      Tahole:
      👉 Shobai ke dite hobe na
      👉 Maximum 1000 unique student dite hobe
    - **Part 3 - Sampling Rule**please provide a sample across all training products on your scope…
      **Meaning:**Random vabe ekta sample dite hobe
      But:
      ✔ Shob training product theke include korte hobe
      ✔ Sudhu ekta qualification theke 1000 student nile hobe na
    - **Part 4 - Random Method (Surname A–Z Rule):**select students with a surname starting with A to Z **Meaning:**Eta ekta manual randomisation technique **Example:**Dhori 2000 student ache **So amader:
      \*\*** A diye shuru surname gula nei
      **\*\*** Tarpor B
      **\*\*** Tarpor C
      **\*\*** Continue korte hobe
      Jotokkhon na 1000 unique student hoy
      👉 Eta jeno unbiased sample hoy
    - **Part 5 - Unique Student Rule (Very Important)**Unique student means each student listed below is unique **Meaning:**Eta most critical part. **Ek student jodi:
      \*\*** 2 ta qualification e enrol kore
      **\*\*** 3 ta unit complete kore **Tobuo:
      👉 Sheet e sudhu 1 bar thakbe
      Karon: ASQA sudhu 1 ta survey invite pathabe.**
    - **Part 6 - Duplicate Check Columns
      Column E (Mobile number) and Column H (student email address)** will **highlight red** if duplicate values are identified.
      **Meaning:**Excel e conditional formatting ase
      Jodi:
      **\*\*** Same mobile number 2 bar ba tar odhik ashe
      **\*\*** Same email 2 bar ba tar odhik ashe
      Tahole red highlight korte hobe.
      👉 Eta ensure kore je student duplicate list hocche na.
- **Question (On previous answer):** Part 2 te j bola holo "Maximum 1000 unique student dite hobe" shekhaneo ki **Enrolled and Completed** miliye **1000** unique nite hobe? Naki shudhu Completed? Or shudhu Enrolled?
  - **Answer:** শুধু completed না, Enrolled + Completed মিলিয়ে 1000 unique student নিতে হবে
- **Question:** Accha reporting er jonno j **excel/csv** file **output** hishebe ber korbo tar moddhe ei (given) **template er jeshob text ba column title ba field name gulo jevabe ache** shegulo thakbe, and ami just tar nicher row gulo te value insert kore jabo dynamically logic wise?
  - **Answer:** Yes. ASQA reporting er ক্ষেত্রে safest approach হলো:✔ Template structure exactly maintain করা
    ✔ Header text / column name change না করা
    ✔ শুধু নিচের row গুলো dynamically fill করা
- **Question:** Accha ekhon kotha holo ASQA report er jonno amr SMS software e, **RTO er theke** ki date range mane **Start date and End date** nibo naki **shudhu ekta date** nibo, jei date theke 12 month picher data and 6 month picher data niye report make korbo?
  - **Answer:**
    ASQA instruction অনুযায়ী:
    **\*\*** Delivery Data & Student Survey → last 12 months
    **\*\*** Enrolment & Completion → সাধারণত last 6 months (audit type অনুযায়ী)
    কিন্তু ⚠️ ASQA সবসময় fixed “today minus 12 months” ধরে না।
    Audit letter এ specific period দিতে পারে।
    **Best SaaS Design (Recommended)**RTO ke option deya:
    **Option A – Custom Date Range
    \*\*** Start Date
    **\*\*** End Date
    **Option B – Auto Mode
    \*\*** Last 12 months (from today - current date)
- **Question (Based on last answer):** Accha ami 2 ta option e dibo date select er jonno. But fact holo Custom Date range e ki tahole **RTO k always 12 months er difference er date e select korte hobe** always. Right? Jodi tai hoy tahole ami shei restriction ta dibo r ki, **let's say date picker theke 2 ta date select korlo jetar difference 10 months tahole sheta ami choose korte dibo na.**
  - **Answer:** Na, restriction deya jaabe na. Ete kore Audit e jhamela hote pare.
    Reason:
    ASQA audit letter often বলে:
    “Provide last 12 months”
    But কখনো বলে:
    **\*\*** Specific financial year
    **\*\*** Specific audit window
    **\*\*** 9 months
    **\*\*** 14 months (rare but happens)
    **\*\*** Or any duration
    So jodi force kora hoy: Date difference must be exactly 12 months
    তাহলে RTO real audit case এ আটকে যাবে।
    **Production Best Practice**Date picker এ restriction না দেয়া।
    বরং:
    **UI তে hint দেখানো যেতে পারে:**
    “ASQA Student Survey typically requires 12 months of data.”
- **Question:** Delivery data summary and Student Survey sheet e 12 months er data, but Enrollment er completion e 6 months er data lagteche, so ami ki **Enrollment er jonno different date picker dibo**? naki **jei 12 months select korbe tar last er 6 months niye** nibo 3rd sheet (Enrollment & Completion Data) er jonno?
  - **Answer:** Last 6 months nite hobe jei date range e dik na keno.
    - Jodi date range 12 months na diye 9 months deya hoy tahole first 2 ta sheet full date range use korbe and third sheet ta shei range er last 6 months use korbe.
    - Jodi amon hoy j date range 6 months er o kom, tahole 3 ta sheet e full date range use korbe.
- **Question:** R amon ki hote pare j ei sheet gulo ekta ekta RTO generate korte chacche? Naki shob sheets eksathei always generate korbe?
  - **Answer:** 2 tai korte hote pare. Tai best holo 2 ta option e rakha.
    - **Option A:** Total compliance report (All - Delivery Data, Student Survey, Enrollment & Completion)
    - **Option B:** Single Sheet (Delivery Data **OR** Student Survey **OR** Enrollment & Completion)
- **Question:** Delivery Data sheet, e "Completed By" ekta field ache, shekhaner value ki hobe? Ekhane ki RTO er name e boshiye dibo?
  - **Answer:** **“Completed By” = যে ব্যক্তি এই report প্রস্তুত করেছে**❌ এটা RTO এর নাম না
    ❌ এটা organisation name না
    ❌ এটা qualification name না
    ❌ এটা SMS software name না
    Production-level SMS এ **report generate করার আগে frontend থেকে “Report Completed By” field নেওয়া best practice**।
- **Question:** Enrollment and Completion Data sheet e, ekta column ache Student ID Number. Eta ki USI ID ta?
  - **Answer:**
    **“Student ID Number” = USI না।**
    **তাহলে “Student ID Number” কী?
    Student ID Number = RTO internal student ID**মানে:
    **\*\*** SMS এ যে student_id generate হয়
    **\*\*** RTO যে learner reference number ব্যবহার করে
    **\*\*** Internal enrolment ID

## **AVETMISS Reporting**

Upcoming
