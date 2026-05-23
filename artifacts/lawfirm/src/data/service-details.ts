export interface ServiceDetail {
  tagline: string;
  overview: string;
  benefits: string[];
  eligibility: string;
  process: { title: string; description: string }[];
  documentsRequired: string[];
  formsToFill: string[];
  timeRequired: string;
  validity: string;
  charges: { item: string; amount: string; note?: string }[];
  faq: { q: string; a: string }[];
}

const DETAILS: Record<string, Partial<ServiceDetail>> = {

  // ── BUSINESS SETUP ─────────────────────────────────────────────────────────

  "business-setup/private-limited-company": {
    tagline: "India's most popular structure for startups and growing businesses",
    overview: "A Private Limited Company (Pvt Ltd) is the most preferred business structure in India, offering limited liability protection, easy access to funding, and high credibility. It requires at least 2 directors and 2 shareholders. The company's shares are held privately and cannot be publicly traded.",
    benefits: ["Limited liability — personal assets protected","Separate legal entity — can own property, sue and be sued","Easier to raise equity funding from investors","Higher credibility with clients and vendors","Perpetual succession — company continues even if owners change","Tax advantages including deductions for business expenses"],
    eligibility: "Minimum 2 directors (at least 1 Indian resident) and 2 shareholders. No minimum paid-up capital required after Companies Amendment Act, 2015.",
    process: [
      { title: "Obtain DSC for Directors", description: "Digital Signature Certificates (Class-3) are obtained for all proposed directors. Required for filing e-forms on the MCA portal." },
      { title: "Apply for DIN", description: "Director Identification Number (DIN) is applied for all proposed directors via SPICe+ form if they don't already have one." },
      { title: "Name Reservation (RUN)", description: "Reserve a unique company name on MCA portal using the RUN (Reserve Unique Name) form. Up to 2 names can be submitted." },
      { title: "Drafting MOA & AOA", description: "Memorandum of Association (objects clause) and Articles of Association (internal rules) are drafted and reviewed." },
      { title: "Filing SPICe+ Form", description: "The integrated incorporation form SPICe+ is filed on MCA portal with all attachments — MOA, AOA, affidavits, declarations." },
      { title: "Certificate of Incorporation", description: "MCA issues the Certificate of Incorporation (CIN) with PAN and TAN. The company is now legally registered." },
      { title: "Open Bank Account", description: "Open a current account in the company name using the CIN, MOA, AOA, and director KYC documents." },
    ],
    documentsRequired: ["PAN Card of all directors & shareholders","Aadhaar Card / Passport / Driving License (ID proof)","Utility bill / Bank statement (address proof — not older than 2 months)","Passport-size photographs","Registered office proof (Rent agreement + NOC from owner, or ownership document)","Electricity bill of registered office"],
    formsToFill: ["SPICe+ (INC-32) — Incorporation form","e-MOA (INC-33) — Memorandum of Association","e-AOA (INC-34) — Articles of Association","AGILE-PRO-S — GST, EPFO, ESIC, Profession Tax, Bank account, Shops & Establishments"],
    timeRequired: "7–10 working days (post submission of all documents)",
    validity: "Perpetual (until struck off or wound up)",
    charges: [
      { item: "Government filing fee (MCA)", amount: "₹0–₹2,000", note: "Based on authorized capital" },
      { item: "Stamp duty on MOA & AOA", amount: "₹200–₹2,000", note: "Varies by state" },
      { item: "Professional/Service fee", amount: "₹4,999", note: "Vakil & Co. all-inclusive" },
      { item: "DSC (per director)", amount: "₹1,299 each", note: "If not already available" },
    ],
    faq: [
      { q: "How many directors are required for a Private Limited Company?", a: "A minimum of 2 directors and a maximum of 15 directors. At least one director must be a resident of India (stayed in India for ≥182 days in the previous calendar year)." },
      { q: "Is there a minimum capital requirement?", a: "No. The Companies Amendment Act, 2015 removed the minimum paid-up capital requirement. You can incorporate with any amount." },
      { q: "Can an NRI or foreign national be a director?", a: "Yes. An NRI or foreign national can be a director; however, at least one director must be a resident Indian." },
      { q: "Can I register a Pvt Ltd company from home address?", a: "Yes. You can use your residential address as the registered office. You'll need a NOC from the property owner and a utility bill as proof." },
      { q: "What is the annual compliance cost?", a: "Typically ₹8,000–₹15,000/year including ROC filings (AOC-4, MGT-7), board meeting minutes, and annual audited financial statements." },
      { q: "How long does the process take?", a: "Usually 7–10 working days after submission of all complete documents to Vakil & Co." },
    ],
  },

  "business-setup/limited-liability-partnership": {
    tagline: "Flexible, cost-effective structure combining the benefits of a company and partnership",
    overview: "An LLP (Limited Liability Partnership) is a hybrid business structure that combines the advantages of a traditional partnership with limited liability protection for its partners. It is governed by the Limited Liability Partnership Act, 2008 and is ideal for professionals, service businesses, and small enterprises.",
    benefits: ["Limited liability — partners' personal assets protected","No minimum capital requirement","Lower compliance burden compared to Pvt Ltd","Partners can freely transfer their contribution","Income taxed at flat 30% + surcharge (no dividend distribution tax)","Less restrictions on audit (turnover < ₹40 lakh exempt from compulsory audit)"],
    eligibility: "Minimum 2 designated partners, both of whom must be individuals. At least one must be an Indian resident. No maximum limit on partners.",
    process: [
      { title: "Obtain DSC for Designated Partners", description: "Digital Signature Certificates for all proposed designated partners are obtained." },
      { title: "Apply for DPIN", description: "Designated Partner Identification Number (DPIN) is applied for all proposed designated partners." },
      { title: "Name Reservation (RUN-LLP)", description: "Reserve the LLP name on MCA portal. The name must end with 'LLP' or 'Limited Liability Partnership'." },
      { title: "Draft LLP Agreement", description: "The LLP Agreement defining rights, duties, profit-sharing, and management structure of partners is drafted." },
      { title: "File FiLLiP Form", description: "Form FiLLiP (Form for incorporation of Limited Liability Partnership) is filed on MCA with all documents." },
      { title: "Certificate of Incorporation", description: "MCA issues Certificate of Incorporation with LLPIN. LLP is now registered." },
      { title: "File LLP Agreement (Form 3)", description: "LLP Agreement must be filed with MCA within 30 days of incorporation via Form 3." },
    ],
    documentsRequired: ["PAN of all partners","Aadhaar / Passport / Voter ID (identity proof)","Bank statement / Utility bill (address proof — recent 2 months)","Registered office proof (NOC + rent agreement or ownership proof)","Passport-size photographs","Utility bill of registered office"],
    formsToFill: ["FiLLiP — LLP Incorporation form","Form 3 — LLP Agreement (within 30 days of incorporation)","Form 4 — Particulars of partners"],
    timeRequired: "10–15 working days",
    validity: "Perpetual",
    charges: [
      { item: "Government filing fee", amount: "₹500–₹1,000", note: "Based on contribution amount" },
      { item: "Stamp duty on LLP Agreement", amount: "₹200–₹5,000", note: "Varies by state" },
      { item: "Professional/Service fee", amount: "₹5,999", note: "Vakil & Co. inclusive" },
    ],
    faq: [
      { q: "What is the difference between LLP and Partnership Firm?", a: "In a LLP, partners have limited liability (personal assets are protected). In a regular partnership, partners have unlimited liability. LLP is a separate legal entity; a partnership firm is not." },
      { q: "Can an LLP be converted to a Private Limited Company?", a: "Yes. An LLP can be converted to a Private Limited Company under the Companies Act. However, it requires ROC approvals and cannot be done if the LLP has pending dues." },
      { q: "Is audit mandatory for LLP?", a: "Statutory audit is mandatory only if: (a) turnover exceeds ₹40 lakh, or (b) capital contribution exceeds ₹25 lakh." },
      { q: "What is the annual compliance for an LLP?", a: "LLP must file Form 11 (Annual Return) by 30 May and Form 8 (Statement of Accounts) by 30 October each year." },
    ],
  },

  "business-setup/one-person-company": {
    tagline: "The only structure that gives a solo entrepreneur full corporate benefits",
    overview: "A One Person Company (OPC) is a unique company structure introduced under the Companies Act, 2013 that allows a single individual to run a company with limited liability. It is ideal for sole entrepreneurs who want corporate benefits without needing a co-founder or partner.",
    benefits: ["Single founder — no need for a partner or co-director","Limited liability protection","Full control retained by one person","Separate legal entity","Can be converted to Pvt Ltd when ready to scale","Less compliance than Pvt Ltd"],
    eligibility: "Only an Indian citizen and resident (stayed ≥182 days in India in the previous year) can form an OPC. One person can have only one OPC at a time. Nominee must be an Indian citizen and resident.",
    process: [
      { title: "Obtain DSC", description: "Get Class-3 Digital Signature Certificate for the sole member (director)." },
      { title: "Apply for DIN", description: "Director Identification Number is obtained through SPICe+ form." },
      { title: "Name Reservation", description: "Reserve company name via RUN (Reserve Unique Name) on MCA portal." },
      { title: "Consent of Nominee", description: "Obtain written consent of the nominee in Form INC-3. The nominee takes over the company in case of death or incapacity of the member." },
      { title: "Draft MOA & AOA", description: "Memorandum and Articles of Association are drafted mentioning the sole member." },
      { title: "File SPICe+ Form", description: "Incorporation form is filed with MOA, AOA, nominee consent, and other documents." },
      { title: "Receive Certificate of Incorporation", description: "MCA issues Certificate of Incorporation with CIN. OPC is now registered." },
    ],
    documentsRequired: ["PAN Card of sole member and nominee","Aadhaar / Passport (identity proof)","Utility bill / Bank statement (address proof)","Registered office address proof (NOC + rent agreement)","Nominee's identity and address proof","Passport-size photographs"],
    formsToFill: ["SPICe+ (INC-32)","e-MOA (INC-33)","e-AOA (INC-34)","INC-3 (Nominee Consent)"],
    timeRequired: "7–10 working days",
    validity: "Perpetual",
    charges: [
      { item: "Government fee", amount: "₹0–₹1,000", note: "Nominal for small capital" },
      { item: "Stamp duty", amount: "₹200–₹1,000" },
      { item: "Professional fee", amount: "₹6,499", note: "Vakil & Co. inclusive" },
    ],
    faq: [
      { q: "Can an OPC have employees?", a: "Yes. An OPC can have any number of employees. Only the ownership/directorship is limited to one person." },
      { q: "Is an OPC required to hold an AGM?", a: "No. OPC is exempt from conducting Annual General Meetings (AGMs). The sole member's decisions are deemed as resolutions." },
      { q: "What are the mandatory conversions for an OPC?", a: "An OPC must mandatorily convert to a Private Limited Company if paid-up share capital exceeds ₹50 lakh or annual turnover exceeds ₹2 crore." },
    ],
  },

  "business-setup/gst-registration-business": {
    tagline: "Register your business for GST and start trading legally across India",
    overview: "GST (Goods and Services Tax) Registration is mandatory for businesses with aggregate annual turnover exceeding ₹40 lakh (₹20 lakh for service providers in most states, ₹10 lakh for special category states). It is also compulsory for inter-state supply, e-commerce operators, and businesses under the reverse charge mechanism.",
    benefits: [],
    eligibility: "Annual turnover > ₹40 lakh (goods) or ₹20 lakh (services). Mandatory regardless of turnover for: inter-state suppliers, e-commerce operators, casual taxable persons, non-resident taxable persons.",
    process: [
      { title: "Gather Documents", description: "Collect PAN, Aadhaar, business proof, bank account details, and address proof." },
      { title: "Register on GST Portal", description: "Fill Part A of Form GST REG-01 on www.gst.gov.in with basic business details and get Temporary Reference Number (TRN)." },
      { title: "Complete Part B", description: "Log in with TRN and fill Part B with detailed information about business, promoters, and bank accounts. Upload documents." },
      { title: "Verification & ARN", description: "Submit the application. Application Reference Number (ARN) is generated for tracking." },
      { title: "GST Officer Processing", description: "GST officer reviews the application. May raise queries (Form GST REG-03) within 3 working days." },
      { title: "GSTIN Issued", description: "If application is complete, GSTIN (15-digit GST Identification Number) is issued in Form GST REG-06." },
    ],
    documentsRequired: ["PAN of business / proprietor / company","Aadhaar of promoters/directors","Business registration proof (COI / Partnership deed / MOA)","Address proof of principal place of business (Rent agreement + NOC or electricity bill if owned)","Bank account details (cancelled cheque or bank statement)","Passport-size photographs of promoters","Authorization letter / Board resolution for authorized signatory"],
    formsToFill: ["GST REG-01 — GST Registration Application"],
    timeRequired: "3–7 working days",
    validity: "Perpetual (until cancelled or surrendered)",
    charges: [
      { item: "Government fee", amount: "₹0", note: "GST registration is free of charge" },
      { item: "Professional fee", amount: "₹1,499", note: "Vakil & Co. service charge" },
    ],
    faq: [
      { q: "Is GST registration mandatory for all businesses?", a: "No. It is mandatory only if your annual turnover exceeds the prescribed threshold (₹40 lakh for goods, ₹20 lakh for services in most states) or if you engage in inter-state supply, e-commerce, etc." },
      { q: "Can I have multiple GST registrations?", a: "Yes. If you have business operations in multiple states, you need a separate GST registration for each state. Within one state, you may take separate registration for different business verticals." },
      { q: "What is the GST Composition Scheme?", a: "Small businesses with turnover up to ₹1.5 crore can opt for the Composition Scheme and pay a fixed rate of tax (1–5%) on turnover instead of regular GST rates. They cannot issue tax invoices or claim ITC." },
      { q: "What happens if I don't register for GST despite being liable?", a: "You can face a penalty of ₹10,000 or the amount of tax evaded (whichever is higher) plus interest on the outstanding tax." },
    ],
  },

  "business-setup/startup-india-registration": {
    tagline: "Get DPIIT recognition and unlock tax exemptions, funding, and government support",
    overview: "Startup India Registration (DPIIT Recognition) is an initiative by the Government of India to support and recognize innovative startups. Recognized startups get significant benefits including income tax exemptions, easier compliance, self-certification, faster patent examination, and access to government funds and tenders.",
    benefits: ["Income tax exemption for 3 consecutive years (out of first 10 years)","Exemption from angel tax (Section 56(2)(viib)) for investments up to ₹25 crore","80% rebate on patent filing fees","Faster IPR examination","Exemption from public procurement rules","Access to Fund of Funds (₹10,000 crore corpus)","Labour law self-certification","Simpler winding-up process"],
    eligibility: "Incorporated as Pvt Ltd, LLP, or Partnership Firm; not older than 10 years; annual turnover not exceeded ₹100 crore; working towards innovation/improvement of products or processes; not formed by splitting or reconstructing an existing business.",
    process: [
      { title: "Register on Startup India Portal", description: "Create an account at startupindia.gov.in using your business email." },
      { title: "Fill Entity Details", description: "Enter company/LLP registration number, date of incorporation, and PAN details." },
      { title: "Describe Business Innovation", description: "Explain the innovative nature of your product/service, scalability, and employment generation potential." },
      { title: "Upload Documents", description: "Upload Certificate of Incorporation, PAN, and support letters or proof of innovation (patents, awards, etc.)." },
      { title: "Apply for DPIIT Recognition", description: "Submit the application form. DPIIT reviews and may ask for additional information." },
      { title: "Receive DPIIT Certificate", description: "DPIIT issues a recognition certificate with a unique registration number." },
    ],
    documentsRequired: ["Certificate of Incorporation (COI) or Registration Certificate","PAN of the entity","Details about the startup's product/service and its innovative aspect","Director/Partner KYC documents","Revenue/Funding details (if applicable)","Proof of innovation (optional but helpful): patents, awards, funded by incubator"],
    formsToFill: ["Startup India Portal application (online form at startupindia.gov.in)"],
    timeRequired: "2–3 working days",
    validity: "Recognition is valid for 10 years from incorporation or until annual turnover exceeds ₹100 crore",
    charges: [
      { item: "Government fee", amount: "₹0", note: "DPIIT recognition is free" },
      { item: "Professional fee", amount: "₹3,999", note: "Vakil & Co. application assistance" },
    ],
    faq: [
      { q: "Is DPIIT recognition the same as Startup India registration?", a: "Yes. DPIIT (Department for Promotion of Industry and Internal Trade) recognition is the official government registration for startups under the Startup India initiative." },
      { q: "Can an LLP get Startup India recognition?", a: "Yes. Private Limited Companies, LLPs, and registered Partnership Firms are all eligible for DPIIT recognition." },
      { q: "What is the angel tax exemption for startups?", a: "Recognized startups with DPIIT recognition are exempt from tax on amounts received as share premium (angel tax under Section 56(2)(viib)) for investments up to ₹25 crore from eligible investors." },
    ],
  },

  // ── TAX & COMPLIANCE ────────────────────────────────────────────────────────

  "tax-compliance/gst-registration": {
    tagline: "Get your GSTIN in 3–7 days — fully handled end-to-end",
    overview: "GST (Goods and Services Tax) is a comprehensive indirect tax levied on the supply of goods and services. GST Registration gives your business a legal identity, allows you to collect tax from customers, claim input tax credit, and participate in formal trade channels. It is compulsory above the prescribed turnover threshold.",
    benefits: ["Legal authority to collect GST from customers","Claim Input Tax Credit on purchases","Conduct inter-state business without restriction","Increased credibility with large buyers (required by many corporates)","Participate in government tenders","Avoid penalties for operating without GST registration"],
    eligibility: "Mandatory for: turnover > ₹40 lakh (goods) or ₹20 lakh (services); inter-state suppliers; e-commerce sellers; businesses under reverse charge; casual taxable persons.",
    process: [
      { title: "Document Collection", description: "Gather PAN, Aadhaar, address proof, bank account details, and business registration documents." },
      { title: "GST Portal Registration — Part A", description: "Apply on gst.gov.in with PAN and mobile/email OTP verification. Get TRN (Temporary Reference Number)." },
      { title: "Complete Part B Application", description: "Fill complete business details, add promoters, upload documents, and enter bank account information." },
      { title: "Submit & Get ARN", description: "Application Reference Number (ARN) issued for status tracking." },
      { title: "GST Officer Review", description: "Application reviewed within 3 working days. Queries raised in REG-03 if any." },
      { title: "GSTIN Issuance", description: "15-digit GSTIN issued and GST certificate available on portal." },
    ],
    documentsRequired: ["PAN card of applicant/business","Aadhaar of promoters/directors (for e-verification)","Business registration certificate (COI/Partnership deed)","Principal place of business proof (electricity bill + rent agreement/NOC)","Bank account proof (cancelled cheque or statement)","Authorized signatory details + photo","Board resolution (for companies/LLPs)"],
    formsToFill: ["GST REG-01 (online on gst.gov.in)"],
    timeRequired: "3–7 working days",
    validity: "Perpetual until cancelled",
    charges: [
      { item: "Government fee", amount: "NIL" },
      { item: "Professional fee", amount: "₹1,499" },
    ],
    faq: [
      { q: "What is GSTIN?", a: "GSTIN (Goods and Services Tax Identification Number) is a 15-digit unique number assigned to every registered taxpayer. The first 2 digits are the state code, next 10 are PAN, 13th is entity code, 14th is 'Z', and 15th is a checksum digit." },
      { q: "Do I need to file GST returns after registration?", a: "Yes. Once registered, you must file GST returns (GSTR-1 and GSTR-3B at minimum) even if there are nil transactions. Non-filing attracts late fees." },
      { q: "Can I voluntarily register for GST below the threshold?", a: "Yes. Any business can voluntarily register for GST even if turnover is below the threshold to avail input tax credits and enhance credibility." },
    ],
  },

  "tax-compliance/individual-income-tax-filing": {
    tagline: "File your ITR accurately and on time — avoid notices and penalties",
    overview: "Individual Income Tax Return (ITR) filing is an annual obligation for all Indian residents whose income exceeds the basic exemption limit (₹2.5 lakh for below 60 years; ₹3 lakh for senior citizens; ₹5 lakh for super senior citizens). Even those with lower income are required to file if they have foreign assets, turnover over ₹60 lakh, high-value transactions, etc.",
    benefits: ["Proof of income for loans, visas, and financial transactions","Carry forward losses to offset future gains","Claim refund of excess TDS deducted","Access to bank loans and credit facilities","Required for obtaining large insurance policies","Avoids notices and penalties from Income Tax Department"],
    eligibility: "Individuals, HUFs, firms with taxable income above exemption limit. Also mandatory for: those having foreign assets, directors of companies, holders of signing authority in foreign accounts, and those with business/professional turnover over ₹60 lakh/₹10 lakh respectively.",
    process: [
      { title: "Collect Income Documents", description: "Gather Form 16 (from employer), Form 26AS/AIS (tax credit statement), bank interest certificates, capital gains statements, rental income details." },
      { title: "Choose Correct ITR Form", description: "Select the appropriate ITR form: ITR-1 (salaried, one house property, income < ₹50L), ITR-2 (capital gains, foreign assets), ITR-3 (business/profession), ITR-4 (presumptive income)." },
      { title: "Compute Total Income", description: "Calculate income under all five heads: Salary, House Property, Business/Profession, Capital Gains, Other Sources." },
      { title: "Claim Deductions", description: "Apply deductions under Chapter VI-A: 80C (investments), 80D (health insurance), 80G (donations), HRA exemption, LTA, standard deduction, etc." },
      { title: "Compute Tax Liability", description: "Calculate tax after deductions using Old or New Tax Regime. Compare TDS already paid with tax due." },
      { title: "File ITR Online", description: "File ITR on incometax.gov.in. E-verify using Aadhaar OTP, net banking, or by sending signed ITR-V to CPC Bangalore." },
    ],
    documentsRequired: ["PAN Card","Aadhaar Card","Form 16 (from employer — Part A and Part B)","Form 26AS and Annual Information Statement (AIS)","Bank account statements and interest certificates","Capital gains statements (from broker/mutual fund)","Home loan interest certificate (if applicable)","Rental income documents (rent receipts, property details)","Investment proofs for 80C, 80D deductions"],
    formsToFill: ["ITR-1 / ITR-2 / ITR-3 / ITR-4 (as applicable) — filed online at incometax.gov.in"],
    timeRequired: "1–2 working days (document submission to filing)",
    validity: "Annual — must be filed by 31 July each year (or extended deadline)",
    charges: [
      { item: "Salaried individual (ITR-1/ITR-2)", amount: "₹1,499" },
      { item: "Business/professional with audit", amount: "₹4,999 onwards" },
      { item: "Capital gains (complex cases)", amount: "₹2,999 onwards" },
    ],
    faq: [
      { q: "What is the last date to file ITR?", a: "For salaried individuals (non-audit): 31 July. For businesses requiring audit: 31 October. Belated returns can be filed until 31 December of the assessment year with a penalty of up to ₹5,000." },
      { q: "What is the difference between Old and New Tax Regime?", a: "Old regime allows deductions (80C, HRA, etc.). New regime has lower slabs but no deductions. For those with significant deductions, old regime is usually better. From FY 2024-25, new regime is the default." },
      { q: "What happens if I don't file ITR?", a: "Penalty of ₹5,000 (₹1,000 if income < ₹5 lakh), plus interest on unpaid tax, and possible scrutiny notice from the Income Tax Department." },
      { q: "Can I revise my ITR after filing?", a: "Yes. A revised return can be filed any time before the end of the relevant assessment year or before completion of assessment, whichever is earlier." },
    ],
  },

  "tax-compliance/add-a-director": {
    tagline: "Appoint a new director to your company quickly and compliantly",
    overview: "Adding a new director to your Private Limited Company or OPC involves board approval, obtaining DIN (Director Identification Number) for the new director (if not already held), passing a board resolution, and filing the required forms with the MCA within 30 days. Failure to file within 30 days attracts additional fees.",
    benefits: ["Expand management expertise","Onboard investors as nominee directors","Meet compliance requirements for minimum directors","Add specialized skills to the board"],
    eligibility: "The person to be appointed must not be: (a) undischarged insolvent, (b) convicted and imprisoned for ≥6 months in last 5 years, (c) order for disqualification passed by court. Must have valid DIN.",
    process: [
      { title: "Obtain DIN for New Director", description: "If the proposed director does not have a DIN, apply for one via DIR-3 form on MCA portal." },
      { title: "Obtain Consent (DIR-2)", description: "Get written consent of the proposed director to act as director in Form DIR-2." },
      { title: "Board Resolution", description: "Pass a Board Resolution in a duly convened board meeting appointing the director as an Additional Director." },
      { title: "Update Register of Directors", description: "Update the Register of Directors and Key Managerial Personnel maintained by the company." },
      { title: "File Form DIR-12 with MCA", description: "File Form DIR-12 with MCA within 30 days of appointment with the board resolution and DIR-2 as attachments." },
    ],
    documentsRequired: ["PAN and Aadhaar of new director","Passport (for foreign nationals)","DIR-2 — Consent to act as director","Specimen signature of new director","Board Resolution copy","Recent passport-size photograph"],
    formsToFill: ["DIR-3 (if DIN not obtained)","DIR-2 (Consent of director)","DIR-12 (Intimation of appointment/change — filed with MCA)"],
    timeRequired: "3–5 working days",
    validity: "Director continues until resignation, removal, or disqualification",
    charges: [
      { item: "MCA filing fee (DIR-12)", amount: "₹300–₹600", note: "Based on share capital" },
      { item: "DIN fee (DIR-3)", amount: "₹500", note: "If DIN not already obtained" },
      { item: "Professional fee", amount: "₹3,999" },
    ],
    faq: [
      { q: "What is the difference between Additional Director and Regular Director?", a: "An Additional Director holds office only until the next AGM. At the next AGM, shareholders must regularize the appointment by passing an ordinary resolution. A regular director is directly appointed by shareholders." },
      { q: "Can a person be a director in multiple companies?", a: "Yes, a person can be a director in up to 20 companies at a time, out of which not more than 10 can be public companies." },
      { q: "What if we miss the 30-day filing deadline for DIR-12?", a: "Additional government fees apply for late filing: ₹300 per month (up to 3x the normal fee for delays up to 6 months). NCLT adjudication may be required for longer delays." },
    ],
  },

  "tax-compliance/provident-fund-pf-registration": {
    tagline: "Mandatory EPFO registration for organisations with 20 or more employees",
    overview: "Provident Fund (PF) Registration under the Employees' Provident Funds and Miscellaneous Provisions Act, 1952 is mandatory for organisations employing 20 or more persons. Once registered, the employer must deduct 12% of basic wages from employees and contribute an equal amount. This provides retirement savings and social security to employees.",
    benefits: ["Mandatory social security for employees","Employee trust and retention","Penalty avoidance for non-compliance","Employees get retirement corpus, pension, and insurance benefits (EDLI)","PF contributions qualify as business expense (tax deductible)"],
    eligibility: "Organisations with 20 or more employees. Factories employing ≥20 persons engaged in listed industries are mandatorily covered. Smaller establishments can voluntarily register.",
    process: [
      { title: "Gather Company Details", description: "Collect Certificate of Incorporation, PAN, GST, bank details, and employee details." },
      { title: "Register on EPFO Portal (Shram Suvidha)", description: "Register on the Shram Suvidha portal (https://shramsuvidha.gov.in) using company details and DSC." },
      { title: "Fill Employer Registration Form", description: "Complete the Employer Registration Form with business activity, employee count, and wage details." },
      { title: "Upload Documents", description: "Upload supporting documents including COI, PAN, cancelled cheque, address proof, and list of employees." },
      { title: "EPFO Code Allotment", description: "EPFO Regional Office verifies and allots a 22-digit EPFO Establishment Code." },
      { title: "Onboard Employees on EPFO", description: "After code allotment, register all eligible employees on EPFO portal and generate UAN numbers." },
    ],
    documentsRequired: ["Certificate of Incorporation / Registration Certificate","PAN of the establishment","GST Registration Certificate","Bank account proof (cancelled cheque)","Address proof of establishment","List of employees with date of joining, designation, and salary","Digital Signature Certificate (Class-3) of authorised signatory","Rent/lease agreement for business address"],
    formsToFill: ["Online application on EPFO Shram Suvidha portal","Form 5A (Employer details)"],
    timeRequired: "5–10 working days post submission",
    validity: "Perpetual (as long as the establishment operates)",
    charges: [
      { item: "Government fee", amount: "NIL" },
      { item: "Professional fee", amount: "₹2,499" },
      { item: "Monthly PF contribution (per employee)", amount: "24% of basic wages", note: "12% employer + 12% employee" },
    ],
    faq: [
      { q: "What is the monthly contribution breakup?", a: "Employee: 12% of Basic + DA. Employer: 12% split as — 3.67% to EPF account, 8.33% to EPS (Pension), 0.5% EDLI (Insurance), 0.5% admin charges, 0.01% EDLI admin charges." },
      { q: "What is UAN?", a: "Universal Account Number (UAN) is a 12-digit number allotted to each employee member of EPFO. It remains constant throughout an employee's career regardless of employer changes." },
      { q: "When can an employee withdraw PF?", a: "Full withdrawal is allowed after 2 months of unemployment. Partial withdrawal is allowed for: house purchase (after 5 years), medical emergency, marriage (after 7 years), education, etc." },
    ],
  },

  // ── TRADEMARK & IP ──────────────────────────────────────────────────────────

  "trademark-ip/trademark-registration": {
    tagline: "Legally protect your brand name, logo, and tagline across India",
    overview: "Trademark Registration gives you the exclusive legal right to use your brand name, logo, tagline, or symbol for the goods/services in the registered class. Once registered, no one else can use an identical or deceptively similar mark. A registered trademark is denoted by the ® symbol and is valid for 10 years, renewable indefinitely.",
    benefits: ["Exclusive right to use the mark in registered class","Legal protection against imitation and counterfeiting","Can sue for infringement in court","Builds brand equity and consumer trust","Asset that can be licensed or assigned","Prevents others from registering a similar mark","Required for brand protection on e-commerce platforms (Amazon Brand Registry, etc.)"],
    eligibility: "Any person (individual, company, partnership, trust, NGO) claiming to be the proprietor of a trademark used or proposed to be used in commerce can apply.",
    process: [
      { title: "Trademark Search", description: "Conduct a comprehensive search on the Trademark Registry database to check if an identical or similar mark is already registered in your class(es)." },
      { title: "Application Filing (TM-A)", description: "File Form TM-A on the IP India portal (https://ipindia.gov.in) or physically at Trademark Registry offices in Mumbai, Delhi, Chennai, Kolkata, or Ahmedabad." },
      { title: "Examination Report", description: "The Trademark Registry examines the application within 30–90 days and issues an Examination Report. Objections (if any) are communicated via TM-O." },
      { title: "Show Cause Hearing (if objected)", description: "If the mark is objected, a written reply and hearing before the Registrar is required. We prepare and attend the hearing on your behalf." },
      { title: "Publication in Trademark Journal", description: "If accepted, the mark is published in the Official Trademark Journal for public opposition for 4 months." },
      { title: "Registration Certificate", description: "If no opposition is filed (or opposition is decided in your favor), the Trademark Registration Certificate is issued." },
    ],
    documentsRequired: ["Logo file (JPEG/PNG — 8x8 cm, 300 DPI)","Business name and address of applicant","PAN card of applicant/company","Udyam/MSME certificate (for MSME applicants — for fee concession)","Power of Attorney (if filed through an agent)","Date of first use of the mark (if already in use)","Goods/services description"],
    formsToFill: ["TM-A — Trademark Application (online at ipindia.gov.in)","TM-48 — Power of Attorney (if filed through agent)"],
    timeRequired: "18–24 months for final registration; TM™ symbol can be used from application date; ® symbol after registration",
    validity: "10 years from application date, renewable indefinitely for 10 years each time",
    charges: [
      { item: "Government filing fee (per class) — Individuals, Startups, SMEs", amount: "₹4,500" },
      { item: "Government filing fee (per class) — Companies", amount: "₹9,000" },
      { item: "Professional fee", amount: "₹1,999 onwards", note: "Vakil & Co. base fee" },
      { item: "Objection reply / Hearing", amount: "₹2,499 additional", note: "If examination objection raised" },
    ],
    faq: [
      { q: "What is a trademark class?", a: "Trademarks are classified into 45 classes (1–34 for goods, 35–45 for services) under the Nice Classification. You must file in the class relevant to your goods/services. Each class requires a separate application and fee." },
      { q: "Can I use ™ before my trademark is registered?", a: "Yes. The ™ symbol can be used on your mark as soon as you file the application. The ® symbol can only be used after the trademark is officially registered." },
      { q: "What is the difference between trademark objection and trademark opposition?", a: "Objection is raised by the Trademark Examiner during examination. Opposition is raised by a third party during the journal publication period (4 months). Both are separate legal proceedings." },
      { q: "What happens if someone uses my registered trademark?", a: "You can file an infringement suit in a district court or High Court. You can also file a civil suit for passing off. Remedies include injunction, damages, and delivery of infringing goods." },
      { q: "Can a trademark be registered for a color combination?", a: "Yes. Color combinations, three-dimensional marks, sound marks, and even smells can be registered as trademarks in India, though the requirements for establishing distinctiveness are higher." },
    ],
  },

  "trademark-ip/copyright-registration": {
    tagline: "Protect your creative work — books, music, software, films, and more",
    overview: "Copyright is an automatic right that arises the moment an original work is created. However, Copyright Registration with the Copyright Office (under the Ministry of Education) provides legal evidence of ownership, a public record, and is required to initiate copyright infringement lawsuits. It protects literary, musical, artistic, cinematographic works, and computer programs.",
    benefits: ["Prima facie proof of ownership in court","Public record of copyright ownership","Protection against piracy and plagiarism","Can claim statutory damages in infringement cases","Moral rights protection","Protection for 60 years after author's death (literary/artistic/musical works)"],
    eligibility: "The author/creator of an original work, or the employer/company if the work was created in course of employment.",
    process: [
      { title: "Application Filing", description: "File Form XIV online on the Copyright Office portal or via post/in person. Separate form for each work." },
      { title: "Examination", description: "Copyright Office logs the application and issues a diary number. Examiner reviews the application for completeness." },
      { title: "Mandatory Waiting Period", description: "A mandatory 30-day waiting period is provided for anyone to raise an objection to the registration." },
      { title: "Scrutiny & Hearing", description: "If no objection, or if objection is resolved, the application is sent to the Registrar of Copyrights for final approval." },
      { title: "Registration Certificate", description: "Copyright Registration Certificate is issued by the Copyright Office." },
    ],
    documentsRequired: ["Copies of the work (3 copies for physical filing)","Identity proof of applicant (PAN/Aadhaar/Passport)","Address proof","NOC from publisher (if work is published)","Power of Attorney (if applied through agent)","Details of co-authors (if applicable)","Proof of employer-employee relationship (for works created in employment)"],
    formsToFill: ["Form XIV — Application for registration of copyright (copyright.gov.in)"],
    timeRequired: "6–12 months (Copyright Office has significant backlog)",
    validity: "60 years post the death of the author (literary, dramatic, musical, artistic works); 60 years from publication (sound recordings, cinematograph films, government works)",
    charges: [
      { item: "Government fee (literary/musical/artistic)", amount: "₹500 per work" },
      { item: "Government fee (computer software)", amount: "₹500 per work" },
      { item: "Government fee (cinematograph film)", amount: "₹5,000 per work" },
      { item: "Professional fee", amount: "₹2,999" },
    ],
    faq: [
      { q: "Does copyright registration give me copyright in the work?", a: "No. Copyright is automatic upon creation of an original work. Registration does not create copyright; it creates a public record and provides legal evidence of ownership." },
      { q: "Can I register copyright for a website?", a: "Yes. Website content (text, code, design elements, graphics) is protected by copyright. You can register the literary content (source code, text) and artistic elements separately." },
      { q: "What is the poor man's copyright?", a: "This is a myth. Sending yourself a copy of your work by post (to create a sealed, dated record) has NO legal value in Indian copyright law. Official registration is the only way to create a reliable public record." },
    ],
  },

  "trademark-ip/provisional-application": {
    tagline: "Secure your invention date immediately — buy 12 months to develop your idea",
    overview: "A Provisional Patent Application allows you to file for a patent without a complete specification. It 'stakes your claim' on the invention date (priority date), giving you 12 months to file the complete (non-provisional) application. It is the fastest and most cost-effective way to begin the patent protection process.",
    benefits: ["Establishes your priority date immediately","12 months to develop, test, and refine the invention","Can use 'Patent Pending' status after filing","Lower cost than a complete application","Prevents others from patenting the same idea","Useful for investor discussions and funding rounds"],
    eligibility: "The true and first inventor(s) of a new invention or their legal representative.",
    process: [
      { title: "Invention Disclosure & Prior Art Search", description: "Document your invention in detail. Conduct a prior art search to confirm novelty — no identical invention should exist in public domain." },
      { title: "Prepare Provisional Specification", description: "Draft a description of the invention with drawings (if necessary). Does not need claims or abstract." },
      { title: "File at Indian Patent Office", description: "File Form 1 (Application) + Form 2 (Provisional Specification) at the relevant Patent Office (Kolkata, Delhi, Mumbai, Chennai) based on applicant's address." },
      { title: "Receive Application Number", description: "Patent Office assigns an application number. 'Patent Pending' status is now active." },
      { title: "File Complete Specification (within 12 months)", description: "File Form 2 (Complete Specification) with claims within 12 months of provisional filing, or the application lapses." },
    ],
    documentsRequired: ["Invention disclosure document","Drawings/diagrams (if applicable)","PAN and address of all inventors","Assignment deed (if applicant is different from inventor)","Form 26 (authorization if filed through agent)"],
    formsToFill: ["Form 1 — Application for Grant of Patent","Form 2 — Provisional Specification"],
    timeRequired: "Application filed same day; examination of complete specification takes 48–60 months (request for examination is mandatory)",
    validity: "Provisional application: 12 months (must file complete application); Complete patent: 20 years from filing date",
    charges: [
      { item: "Government fee — natural person (Form 1 + Form 2)", amount: "₹1,600", note: "Reduced fee for individuals/small entities" },
      { item: "Government fee — startups/small entity", amount: "₹4,000" },
      { item: "Government fee — large entity/company", amount: "₹8,000" },
      { item: "Professional/drafting fee", amount: "₹14,999", note: "Vakil & Co. (includes prior art search + drafting)" },
    ],
    faq: [
      { q: "What happens after the 12-month period?", a: "You must file a complete specification (non-provisional application with claims) within 12 months of the provisional filing date. If you miss this deadline, the provisional application lapses and you lose your priority date." },
      { q: "Is a provisional application examined by the Patent Office?", a: "No. Provisional applications are not examined. Only complete applications undergo substantive examination (after filing a Request for Examination — Form 18)." },
      { q: "Can I commercialize my invention while the patent application is pending?", a: "Yes. You can manufacture, sell, and license the invention with 'Patent Pending' status. However, you have no legal rights against infringers until the patent is granted." },
    ],
  },

  // ── DOCUMENTATION ───────────────────────────────────────────────────────────

  "documentation/non-disclosure-agreement-nda": {
    tagline: "Protect your confidential information before sharing it with anyone",
    overview: "A Non-Disclosure Agreement (NDA), also known as a Confidentiality Agreement, is a legally binding contract that prevents one or both parties from disclosing confidential information shared during business discussions, partnerships, employment, or any professional relationship. It is one of the most fundamental and widely used legal documents in business.",
    benefits: ["Legally binds parties to confidentiality obligations","Defines exactly what constitutes 'confidential information'","Specifies permitted use of the information","Provides remedies (injunction + damages) for breach","Builds trust in business relationships","Required before sharing trade secrets, business plans, or technical data"],
    eligibility: "Any two or more parties who wish to protect information shared between them. Can be mutual (both parties bound) or one-way (only one party bound).",
    process: [
      { title: "Define Parties & Purpose", description: "Identify the disclosing party, receiving party, and the purpose for which information is being shared." },
      { title: "Draft Confidential Information Clause", description: "Precisely define what information is considered confidential and what is excluded (e.g., publicly available information, information known before disclosure)." },
      { title: "Obligations & Permitted Use", description: "Define how the receiving party may use the information and what precautions must be taken." },
      { title: "Term & Termination", description: "Set the duration of the NDA (usually 2–5 years) and conditions for termination." },
      { title: "Review & Execute", description: "Both parties review, negotiate any changes, and sign. Notarization is optional but recommended for high-value matters." },
    ],
    documentsRequired: ["Details of both parties (full legal name, address, registration no. for companies)","Description of the nature of confidential information","Intended purpose of information sharing","Duration of confidentiality","PAN/ID of signing parties"],
    formsToFill: ["No government form required — privately drafted and executed agreement on stamp paper"],
    timeRequired: "1–2 business days for drafting; execution same day",
    validity: "As specified in the agreement (typically 2–5 years; some provisions survive indefinitely)",
    charges: [
      { item: "Stamp paper (as per state)", amount: "₹100–₹500", note: "Depends on state stamp duty rules" },
      { item: "Professional drafting fee", amount: "₹1,499" },
    ],
    faq: [
      { q: "Is an NDA enforceable in India?", a: "Yes. NDAs are enforceable in India under the Indian Contract Act, 1872. Breach entitles the disclosing party to seek injunction (stop further disclosure), actual damages, and in some cases punitive damages." },
      { q: "Does an NDA need to be notarized?", a: "Notarization is not legally required for an NDA to be valid in India. However, for high-value matters or where parties are in different cities, notarization or registration can add authenticity." },
      { q: "What is a mutual vs one-way NDA?", a: "In a one-way (unilateral) NDA, only one party discloses confidential information and the other is bound to maintain confidentiality. In a mutual (bilateral) NDA, both parties share and protect each other's confidential information." },
      { q: "For how long should an NDA be valid?", a: "This depends on the nature of information. Typical duration is 2–5 years. For trade secrets, perpetual confidentiality obligations are common. Specific industries (pharma, defence) may require longer terms." },
    ],
  },

  "documentation/employment-agreement": {
    tagline: "Set clear expectations and protect your business from the very first hire",
    overview: "An Employment Agreement is a legally binding contract between an employer and an employee defining the terms and conditions of employment. It protects both parties by clearly establishing compensation, responsibilities, working conditions, termination clauses, intellectual property ownership, and restrictive covenants.",
    benefits: ["Clearly defines roles, responsibilities, and reporting structure","Protects company IP — inventions made during employment belong to employer","Non-compete and non-solicitation clauses protect business interests","Clear termination terms avoid wrongful termination disputes","Compensation, benefits, and increment structure are documented","Sets performance expectations and review mechanisms"],
    eligibility: "Any employer-employee relationship. Applicable to full-time, part-time, and fixed-term employees.",
    process: [
      { title: "Define Employment Terms", description: "Finalize designation, CTC, working hours, location, probation period, and notice period." },
      { title: "Draft Agreement", description: "Draft agreement covering all key clauses: compensation, duties, confidentiality, IP assignment, non-compete, termination." },
      { title: "Compliance Check", description: "Ensure agreement complies with applicable labour laws (Shops & Establishments Act, Industrial Employment Act, etc.)." },
      { title: "Review by Both Parties", description: "Both employer and employee review the terms. Negotiate and finalise." },
      { title: "Execute on Stamp Paper", description: "Sign on appropriate stamp paper. Provide one copy to employee." },
    ],
    documentsRequired: ["Employee personal details (name, address, PAN, Aadhaar)","Designation and department details","Compensation structure (CTC breakup)","Company letterhead and incorporation details","HR policy documents to be referenced"],
    formsToFill: ["No government form — privately executed agreement"],
    timeRequired: "1–2 business days",
    validity: "Until terminated per the terms of the agreement",
    charges: [
      { item: "Stamp paper", amount: "₹100–₹500", note: "As per state" },
      { item: "Professional fee", amount: "₹1,999" },
    ],
    faq: [
      { q: "Is a separate offer letter sufficient, or do I need a full employment agreement?", a: "An offer letter covers basic terms but is usually not comprehensive enough. A full Employment Agreement covers confidentiality, IP ownership, non-compete, dispute resolution, and termination — all essential for protecting your business." },
      { q: "Are non-compete clauses enforceable in India?", a: "Non-compete clauses operative during employment are generally enforceable. Post-employment non-compete clauses are typically not enforceable in India (Section 27 of Indian Contract Act restricts contracts in restraint of trade). However, non-solicitation of clients/employees can be enforceable." },
    ],
  },

  // ── NGO ─────────────────────────────────────────────────────────────────────

  "ngo/section-8-company": {
    tagline: "The most credible and structured form for running a non-profit in India",
    overview: "A Section 8 Company (under Section 8 of the Companies Act, 2013) is incorporated for promoting commerce, art, science, sports, education, research, social welfare, religion, charity, or protection of environment or any such other object. It has all the benefits of a Private Limited Company (separate legal entity, limited liability) but is structured as a non-profit.",
    benefits: ["Separate legal entity with limited liability","Higher credibility than trust or society","Can receive domestic and foreign donations (with FCRA)","Eligible for 80G and 12A tax exemptions","No minimum capital required","Governance transparency through ROC filings"],
    eligibility: "Any person or association of persons with a charitable objective. Minimum 2 directors/shareholders required.",
    process: [
      { title: "Obtain DSC & DIN", description: "Get Digital Signature Certificates and Director Identification Numbers for all proposed directors." },
      { title: "Name Reservation", description: "Reserve company name on MCA portal. Section 8 companies cannot use words like 'Limited' or 'Private Limited' in the name." },
      { title: "Application for License (INC-12)", description: "File Form INC-12 seeking license to operate as a Section 8 Company with the draft MOA and AOA." },
      { title: "MOA & AOA Drafting", description: "Draft MOA and AOA specifically for charitable activities (objects clause must be non-profit in nature)." },
      { title: "Incorporation via SPICe+", description: "File SPICe+ form after obtaining INC-16 license. Company is incorporated as a Section 8 entity." },
      { title: "Post-incorporation Compliance", description: "Open bank account, apply for 80G and 12A exemptions, NITI Aayog Darpan registration, FCRA if receiving foreign funds." },
    ],
    documentsRequired: ["PAN, Aadhaar, and address proof of all directors","Registered office address proof","Draft MOA and AOA","Declaration in INC-14 by CA/CS/Advocate","INC-15 declaration by directors","Estimate of income and expenditure for 3 years","List of promoters with address and occupation"],
    formsToFill: ["INC-12 — Application for Section 8 license","SPICe+ — Incorporation form","INC-14 & INC-15 — Declarations"],
    timeRequired: "15–20 working days",
    validity: "Perpetual",
    charges: [
      { item: "Government fee (MCA)", amount: "₹0–₹2,000", note: "Nominal for Section 8 companies" },
      { item: "Stamp duty on MOA & AOA", amount: "₹500–₹1,500" },
      { item: "Professional fee", amount: "₹14,999" },
    ],
    faq: [
      { q: "What is the difference between Section 8 Company, Trust, and Society?", a: "Section 8 Company has the highest governance and credibility, is regulated by ROC, offers limited liability, and is preferred by international donors. Trust is simpler to form but has limited accountability. Society requires ≥7 members. Section 8 is preferred for scaling and institutional funding." },
      { q: "Can a Section 8 Company pay salaries to its directors?", a: "Section 8 companies can pay reasonable remuneration to their directors for services rendered. However, payment of profits/dividends is not allowed — all surplus must be reinvested in the non-profit objectives." },
      { q: "What are 80G and 12A certificates?", a: "12A exempts the NGO's income from tax. 80G allows donors to claim deduction (50–100%) of their donation from their taxable income. Both are issued by the Income Tax Department and are critical for donor trust." },
    ],
  },

  // ── PROPERTY & PERSONAL ─────────────────────────────────────────────────────

  "property-personal/property-registration": {
    tagline: "Complete your property purchase legally — title registration at the Sub-Registrar office",
    overview: "Property Registration is the mandatory process of recording a property's ownership transfer at the office of the Sub-Registrar of Assurances under the Registration Act, 1908. Without registration, a property transfer is not legally valid, and the new owner cannot claim legal title. The process involves execution of a Sale Deed, payment of stamp duty, and registration with the Sub-Registrar.",
    benefits: ["Creates legal title in the new owner's name","Protects against future ownership disputes","Required for getting home loans, mortgages","Ensures the property is free from encumbrances","Allows future resale or mortgage of the property","Public record prevents fraud and double selling"],
    eligibility: "Any buyer and seller of immovable property where the value exceeds ₹100 (Section 17 of Registration Act makes registration compulsory).",
    process: [
      { title: "Title Verification", description: "Verify the property title by examining chain of ownership documents for the past 30 years. Check for encumbrances, pending dues, and litigation." },
      { title: "Draft Sale Deed", description: "Draft the Sale Deed incorporating all property details, sale consideration, possession, representations, and conditions." },
      { title: "Calculate Stamp Duty", description: "Calculate stamp duty payable based on circle rate (government-prescribed value) or actual sale price (whichever is higher). Rates vary by state (4–7% typically)." },
      { title: "Pay Stamp Duty & Registration Fee", description: "Pay stamp duty via e-stamping or franking. Pay registration fee (typically 1% of property value, capped in most states)." },
      { title: "Appointment at Sub-Registrar Office", description: "Both buyer and seller (and 2 witnesses) must appear at the Sub-Registrar's office with original documents and identities." },
      { title: "Biometric Verification & Registration", description: "Sub-Registrar verifies identity, takes thumb impressions and photographs. Documents are registered and scanned into the official record." },
      { title: "Receive Registered Documents", description: "Registered Sale Deed is returned to the buyer. Update municipality records and apply for mutation." },
    ],
    documentsRequired: ["Original Sale Deed (executed on stamp paper of appropriate value)","Title documents — chain of ownership (parent documents)","Encumbrance Certificate (EC) from SRO","Previous Sale Deeds","Latest property tax receipts","NOC from Housing Society (for apartments)","Identity proof of buyer, seller, and 2 witnesses","PAN cards of both buyer and seller","Passport-size photographs","Completion certificate / Occupancy Certificate (for new buildings)"],
    formsToFill: ["Sale Deed — executed on appropriate stamp paper","Form 60/61 if PAN not available","TDS Certificate (Form 26QB) — if property value > ₹50 lakh, buyer must deduct 1% TDS"],
    timeRequired: "1–2 days for registration appointment (after title verification and document preparation; 2–4 weeks total)",
    validity: "Perpetual — once registered, ownership is permanent until transferred again",
    charges: [
      { item: "Stamp duty", amount: "4–7% of property value", note: "Varies by state and gender of buyer" },
      { item: "Registration fee", amount: "0.5–1% of property value", note: "Usually capped at ₹30,000–₹1,00,000 in most states" },
      { item: "Legal / professional fee", amount: "₹5,999", note: "Vakil & Co. (title verification + deed drafting + registration)" },
    ],
    faq: [
      { q: "Is stamp duty the same across all states?", a: "No. Stamp duty varies significantly: Maharashtra charges 5–6%, Karnataka 3–5.6%, Delhi 4–6%, UP 7%, Tamil Nadu 7%, Rajasthan 5–6%. Many states offer concessions for women buyers (0.5–2% reduction)." },
      { q: "Can property be transferred without going to the Sub-Registrar office?", a: "No. Physical appearance of both buyer and seller (or their authorized attorney holders) is mandatory at the Sub-Registrar's office for registration. Online bookings are available in many states." },
      { q: "What is mutation of property?", a: "Mutation is the process of updating the government's revenue records to reflect the new owner. While registration creates legal title, mutation updates municipal/panchayat records for property tax purposes. It should be done within 3 months of registration." },
      { q: "What is TDS on property purchase?", a: "Under Section 194-IA of Income Tax Act, if the property value exceeds ₹50 lakh, the buyer must deduct 1% TDS from the seller's payment and deposit it with the government via Form 26QB within 30 days." },
    ],
  },

  "property-personal/marriage-registration": {
    tagline: "Register your marriage officially — required for passport, visa, and all legal purposes",
    overview: "Marriage Registration is the official recording of a marriage by the government, creating a public record of the union. In India, marriages can be registered under the Hindu Marriage Act, 1955 (for Hindus, Sikhs, Buddhists, Jains) or the Special Marriage Act, 1954 (for all religions and inter-religious marriages). A Marriage Certificate is required for spouse visas, name change, joint bank accounts, property inheritance, and many government procedures.",
    benefits: ["Legal proof of marriage for all official purposes","Required for spouse visa applications","Enables name change in passports and official records","Protects spouse's rights in property and succession","Required for opening joint bank accounts","Proof for insurance and nomination purposes"],
    eligibility: "Hindu Marriage Act: both parties must be Hindu; groom ≥21 years; bride ≥18 years; not within prohibited degrees of relationship. Special Marriage Act: any religion; same age requirement; 30-day notice period required.",
    process: [
      { title: "Choose Applicable Law", description: "Decide whether to register under Hindu Marriage Act (quick, 1 day) or Special Marriage Act (30-day notice period required)." },
      { title: "Apply to Marriage Registrar", description: "Submit application to the Marriage Registrar of the area where either party has resided for at least 30 days. Many states now allow online applications." },
      { title: "Document Submission", description: "Submit all required documents along with the application form and applicable fee." },
      { title: "Verification & Appointment (for HMA)", description: "Documents are verified. Appointment is given (usually within 1–7 days for HMA registrations)." },
      { title: "Appear Before Registrar", description: "Both parties and at least 3 witnesses appear before the Marriage Registrar on the appointed date." },
      { title: "Receive Marriage Certificate", description: "Marriage Certificate is issued immediately or within 1–3 days." },
    ],
    documentsRequired: ["Age proof of both parties (Birth Certificate / Matriculation Certificate / Passport)","Address proof (Aadhaar / Voter ID / Passport)","Passport-size photographs (individual and together)","Marriage invitation card / evidence of marriage (for HMA)","Divorce decree (if previously married)","Death certificate of spouse (if widow/widower)","Identity proofs of 3 witnesses with address","Aadhaar cards of both parties"],
    formsToFill: ["Marriage Registration Application Form (as prescribed by respective state/SDM office)"],
    timeRequired: "1–7 days (Hindu Marriage Act); 30–60 days (Special Marriage Act due to mandatory notice period)",
    validity: "Permanent — a Marriage Certificate is a lifetime document",
    charges: [
      { item: "Government fee", amount: "₹100–₹1,000", note: "Varies by state" },
      { item: "Professional fee", amount: "₹2,999", note: "Vakil & Co. (documentation + coordination)" },
    ],
    faq: [
      { q: "Is it mandatory to register a marriage in India?", a: "The Supreme Court of India (Seema vs Ashwani Kumar, 2006) directed that marriage registration should be made compulsory. Several states have made it mandatory. Even where not mandatory, registration is strongly advisable for practical and legal purposes." },
      { q: "What is the difference between Hindu Marriage Act and Special Marriage Act?", a: "HMA (1955) applies to Hindus, Sikhs, Jains, and Buddhists. No notice period required; registration can be done on the same day as the ceremony or later. SMA (1954) applies to any two people of any religion (including inter-faith couples). Requires 30-day public notice." },
    ],
  },

  // ── LAWYERS & EXPERTS ───────────────────────────────────────────────────────

  "lawyers/criminal-lawyer": {
    tagline: "Expert criminal defense — protect your rights from arrest to acquittal",
    overview: "Our criminal lawyers represent clients in all criminal matters — from bail applications and anticipatory bail to trial defense and High Court appeals. We handle cases under IPC (now BNS — Bharatiya Nyaya Sanhita), POCSO, NDPS, Prevention of Corruption Act, cyber crimes, financial fraud, and more.",
    benefits: ["Immediate response for arrest and custody situations","Bail and anticipatory bail applications","Strong trial defense strategy","Appeals before High Courts and Supreme Court","Guidance on rights — right to remain silent, right to legal representation","Confidential client-attorney communication (privileged)"],
    eligibility: "Anyone who has been arrested, is facing criminal charges, has received a summons or notice from police/court, or needs legal advice in a criminal matter.",
    process: [
      { title: "Initial Consultation", description: "Confidential consultation to understand the facts, charges, and FIR details." },
      { title: "Bail Application", description: "If the client is in custody, immediate bail application before Magistrate/Sessions Court." },
      { title: "Case Review & Strategy", description: "Review FIR, charge sheet, evidence, and witness statements. Develop defense strategy." },
      { title: "Pre-Trial Hearings", description: "Appear for bail, remand hearings, framing of charges, and discharge applications." },
      { title: "Trial Representation", description: "Cross-examine prosecution witnesses, file counter-affidavits, present defense evidence." },
      { title: "Verdict & Appeals", description: "If convicted, file appeal in Sessions Court, High Court, or Supreme Court as appropriate." },
    ],
    documentsRequired: ["Copy of FIR (First Information Report)","Charge sheet (if filed)","Previous court orders / bail orders","Identity documents of the accused","Any evidence or documents helpful to the defense"],
    formsToFill: ["Vakayalatnama (Advocate's Engagement Form — filed before court)","Bail Application","Vakil's brief"],
    timeRequired: "Consultation: same day; bail hearing: 1–3 days; trial: varies (months to years depending on complexity)",
    validity: "Retainer until case disposal",
    charges: [
      { item: "Initial consultation", amount: "₹999" },
      { item: "Bail application", amount: "₹5,000–₹25,000", note: "Based on court and complexity" },
      { item: "Trial retainer", amount: "₹25,000–₹2,00,000+", note: "Based on nature of charges and court" },
    ],
    faq: [
      { q: "What should I do immediately after being arrested?", a: "Stay calm. Do not make any statements to the police without your lawyer present. You have the right to consult a lawyer (Article 22 of the Constitution). Call Vakil & Co. immediately on our 24×7 helpline." },
      { q: "What is the difference between bail and anticipatory bail?", a: "Bail is applied for after arrest. Anticipatory bail (under Section 438 CrPC/Bhartiya Nagarik Suraksha Sanhita) is applied for before arrest, when a person apprehends arrest. It is granted by Sessions Court or High Court." },
    ],
  },

  "lawyers/divorce-lawyer": {
    tagline: "Navigate divorce with legal expertise — protect your rights and future",
    overview: "Our family law specialists handle all aspects of divorce and matrimonial disputes — mutual consent divorce (the simplest and fastest route), contested divorce, interim maintenance, permanent alimony, child custody (physical and legal), visitation rights, and division of matrimonial assets. We handle cases under Hindu Marriage Act, Special Marriage Act, Muslim Personal Law, Parsi Marriage Act, and Indian Divorce Act.",
    benefits: ["Confidential, empathetic legal advice","Fastest possible resolution through mutual consent divorce","Strong representation in contested matters","Child custody arrangements protecting your children's interests","Maintenance/alimony negotiation and enforcement","Domestic violence protection orders (under Protection of Women from Domestic Violence Act)"],
    eligibility: "Any married person seeking dissolution of marriage, separation, maintenance, or resolution of matrimonial disputes.",
    process: [
      { title: "Initial Consultation", description: "Confidential discussion of the marriage breakdown, children, assets, and both parties' positions. Understand which type of divorce applies." },
      { title: "Mutual Consent vs Contested Assessment", description: "If both parties agree on all terms, mutual consent divorce is pursued (faster, 6–18 months). If contested, prepare grounds under Section 13 Hindu Marriage Act / applicable law." },
      { title: "File Divorce Petition", description: "File the petition in the Family Court having jurisdiction (usually where parties last resided together)." },
      { title: "Interim Applications", description: "File applications for interim maintenance, child custody, and injunction against disposal of assets if needed." },
      { title: "Mediation (if ordered)", description: "Courts often refer parties to mediation. Vakil & Co. lawyers represent you in mediation proceedings." },
      { title: "Trial / Decree", description: "In mutual consent: two motions heard; decree after 6-month cooling period (can be waived). In contested: full trial, evidence, witnesses, followed by decree." },
    ],
    documentsRequired: ["Marriage Certificate","Aadhaar / Passport (identity proof)","Photographs from marriage ceremony","Income/salary details of both parties","Children's birth certificates (if applicable)","Property documents (for asset division)","Bank statements","Evidence of grounds for divorce (for contested divorce)"],
    formsToFill: ["Divorce Petition (drafted by advocate, filed before Family Court)","Vakayalatnama"],
    timeRequired: "Mutual consent: 6–18 months (6 months cooling period mandated by law, can be waived by court); Contested: 2–5 years",
    validity: "Decree of Divorce is permanent",
    charges: [
      { item: "Consultation", amount: "₹999" },
      { item: "Mutual consent divorce", amount: "₹15,000–₹40,000", note: "Both stages, all hearings" },
      { item: "Contested divorce", amount: "₹50,000–₹2,00,000+", note: "Based on complexity and duration" },
    ],
    faq: [
      { q: "What are the grounds for divorce under Hindu Marriage Act?", a: "Cruelty, adultery, desertion (2+ years), conversion to another religion, unsoundness of mind, leprosy/venereal disease, renunciation of world, presumption of death (7 years). Wife has additional grounds: husband guilty of rape/sodomy/bestiality, non-resumption of cohabitation after maintenance decree." },
      { q: "How is child custody decided in India?", a: "The court's paramount consideration is the 'welfare of the child'. Courts may award joint custody or sole custody with visitation rights. Age of the child, relationship with each parent, stability of home environment, and child's preference (for older children) are considered." },
    ],
  },

  // ── CONSULT AN EXPERT ───────────────────────────────────────────────────────

  "consult-expert/talk-to-a-lawyer": {
    tagline: "Get expert legal advice from a qualified advocate within minutes",
    overview: "Connect instantly with an experienced advocate through telephone, video call, or in-person consultation. Our network covers all areas of law — corporate, family, criminal, property, employment, IP, and more. Whether you need a quick opinion on a legal notice or comprehensive advice on a complex matter, our lawyers are available 7 days a week.",
    benefits: ["Immediate access — no long waiting times","Confidential and privileged communication","Expert guidance before taking legal action","Affordable fixed-fee consultation","Available via phone, video, or in-person","Available across all major areas of law"],
    eligibility: "Anyone with a legal query — individuals, startups, small businesses, or corporates.",
    process: [
      { title: "Book Your Consultation", description: "Choose a convenient time slot online or call our helpline for immediate assistance." },
      { title: "Brief Submission", description: "Describe your legal issue briefly on the platform. Attach any relevant documents." },
      { title: "Expert Matching", description: "We match you with the most qualified advocate for your specific matter and jurisdiction." },
      { title: "Consultation", description: "Phone, video, or in-person consultation at the scheduled time. Get clear, actionable advice." },
      { title: "Post-Consultation Summary", description: "Receive a written summary of the advice and recommended next steps via email." },
    ],
    documentsRequired: ["Any relevant legal documents, notices, or contracts you want reviewed","Identity proof (for in-person consultation)"],
    formsToFill: ["Online booking form on Vakil & Co. platform"],
    timeRequired: "Consultation: 30–60 minutes. Available within same day or next day.",
    validity: "Single session (follow-up sessions can be booked separately)",
    charges: [
      { item: "30-minute phone/video consultation", amount: "₹999" },
      { item: "60-minute in-depth consultation", amount: "₹1,799" },
      { item: "In-person consultation (at our office)", amount: "₹2,499" },
    ],
    faq: [
      { q: "Is my conversation with the lawyer confidential?", a: "Absolutely. All communications between you and your lawyer are protected by attorney-client privilege under the Indian Evidence Act and Bar Council of India rules. Nothing you share will be disclosed to any third party." },
      { q: "What types of legal matters can I consult about?", a: "Our lawyers cover all major areas: business/corporate law, family and divorce, property disputes, criminal matters, employment issues, IP/trademark, consumer disputes, NRI matters, and more." },
      { q: "Can I get an opinion on a legal notice I received?", a: "Yes. You can share the notice document during booking and our lawyer will review it before the consultation to provide specific advice on how to respond." },
    ],
  },
};

function generateFallback(categoryId: string, serviceName: string, price: string, description: string): ServiceDetail {
  const isBusinessSetup = categoryId === "business-setup";
  const isTaxCompliance = categoryId === "tax-compliance";
  const isIP = categoryId === "trademark-ip";
  const isDoc = categoryId === "documentation";
  const isNGO = categoryId === "ngo";
  const isProperty = categoryId === "property-personal";
  const isLawyer = categoryId === "lawyers";
  const isConsult = categoryId === "consult-expert";
  const isFundraising = categoryId === "fundraising";

  const processSteps = isBusinessSetup ? [
    { title: "Initial Assessment", description: `Our team reviews your specific requirements for ${serviceName} and advises on the best approach.` },
    { title: "Document Collection", description: "We send you a checklist of documents needed. You upload them securely on our portal." },
    { title: "Application Preparation", description: "We prepare all forms and applications with accuracy and completeness." },
    { title: "Filing & Submission", description: "Documents are submitted to the relevant government authority on your behalf." },
    { title: "Follow-up & Queries", description: "We track your application and respond to any queries from the authority." },
    { title: "Completion", description: `You receive your ${serviceName} certificate/registration along with a compliance guide.` },
  ] : isTaxCompliance ? [
    { title: "Requirement Analysis", description: `We review your business structure and specific requirements for ${serviceName}.` },
    { title: "Document Preparation", description: "All required documents, resolutions, and filings are prepared." },
    { title: "Regulatory Filing", description: "We file the required forms with MCA, Income Tax Department, EPFO, or other relevant authority." },
    { title: "Government Processing", description: "Application is processed by the relevant authority. We handle all queries and deficiencies." },
    { title: "Completion", description: "We deliver the completed registration/filing with documentation for your records." },
  ] : isIP ? [
    { title: "Prior Art / Availability Search", description: "Comprehensive search to ensure your mark/work is unique and registrable." },
    { title: "Application Drafting", description: "Application is drafted and reviewed for completeness and accuracy." },
    { title: "Filing", description: "Application is filed with the relevant IP office (Trademark Registry, Copyright Office, Patent Office)." },
    { title: "Examination Response", description: "Any examination objections or queries are professionally handled." },
    { title: "Registration", description: "Certificate of Registration is obtained and delivered to you." },
  ] : isDoc ? [
    { title: "Briefing", description: "We understand your specific requirements, business context, and objectives for the agreement." },
    { title: "First Draft", description: "A customized draft is prepared incorporating all your requirements and applicable legal standards." },
    { title: "Review & Revisions", description: "You review the draft and request any changes. We revise until you're satisfied." },
    { title: "Finalization", description: "Final document is prepared on appropriate stamp paper." },
    { title: "Execution", description: "Agreement is executed by all parties and copies distributed." },
  ] : isNGO ? [
    { title: "Structure Advisory", description: "We advise on the best NGO structure for your objectives (Section 8, Trust, or Society)." },
    { title: "Document Preparation", description: "All registration documents, MOA, and declarations are prepared." },
    { title: "Registration Filing", description: "Application filed with relevant authority (MCA, Charity Commissioner, Registrar of Societies)." },
    { title: "Approval & Certificate", description: "We handle queries and obtain the registration certificate." },
    { title: "Post-registration Compliance", description: "Assistance with 80G, 12A, Darpan, and other post-registration requirements." },
  ] : isProperty ? [
    { title: "Document Verification", description: "We verify all identity and property documents before proceeding." },
    { title: "Application Preparation", description: "All forms, affidavits, and supporting documents are prepared and verified." },
    { title: "Submission", description: "Application submitted to the relevant authority (Sub-Registrar, court, municipality, etc.)." },
    { title: "Follow-up", description: "We track progress and handle any queries or deficiencies." },
    { title: "Completion", description: "Completed document / certificate is received and delivered to you." },
  ] : isLawyer ? [
    { title: "Consultation Booking", description: "Book a consultation online or by phone. We match you with the right specialist." },
    { title: "Initial Consultation", description: "Discuss your matter in detail. Lawyer reviews relevant documents and provides initial advice." },
    { title: "Strategy & Engagement", description: "If legal action or representation is needed, we formalize the engagement with a detailed brief." },
    { title: "Court / Legal Proceedings", description: "Full representation in court, hearings, or negotiations as required." },
    { title: "Resolution & Follow-up", description: "Matter is resolved and you receive all outcome documents." },
  ] : [
    { title: "Initial Discussion", description: "We understand your specific needs and objectives." },
    { title: "Documentation", description: "Required documents and information are collected." },
    { title: "Processing", description: "Work is processed through the relevant channels." },
    { title: "Delivery", description: "Completed work is delivered with a summary and next steps." },
  ];

  const documents = isBusinessSetup ? [
    "PAN Card of all promoters/directors",
    "Aadhaar Card of all promoters/directors",
    "Address proof (utility bill / bank statement — not older than 2 months)",
    "Passport-size photographs",
    "Registered office address proof (NOC + rent agreement or ownership proof)",
    "Email address and mobile number",
  ] : isTaxCompliance ? [
    "PAN of the company/LLP",
    "Certificate of Incorporation",
    "Board Resolution / Partners' consent",
    "Directors' / Partners' KYC (PAN + Aadhaar)",
    "Financial statements (if applicable)",
    "Relevant registers and records",
  ] : isIP ? [
    "PAN of applicant",
    "Proof of identity (Aadhaar / Passport)",
    "Proof of business registration (if applicable)",
    "Work/creation samples",
    "Power of Attorney (if filed through agent)",
  ] : isDoc ? [
    "Identity proof of all parties (PAN / Aadhaar)",
    "Business registration certificate (for companies/LLPs)",
    "Specific details relevant to the agreement",
  ] : [
    "Identity proof (PAN / Aadhaar / Passport)",
    "Address proof",
    "Relevant supporting documents specific to the matter",
  ];

  const timeMap: Record<string, string> = {
    "business-setup": "7–15 working days",
    "tax-compliance": "5–10 working days",
    "trademark-ip": "3–6 months for registration",
    "documentation": "1–3 working days",
    "ngo": "15–30 working days",
    "property-personal": "5–15 working days",
    "lawyers": "Subject to court schedule",
    "consult-expert": "Same day or next working day",
    "fundraising": "Custom timeline",
  };

  return {
    tagline: description,
    overview: `${serviceName} is a key service offered by Vakil & Co. Legal Associates. ${description} Our experienced team handles every aspect of the process — from document collection and preparation to filing, follow-up, and final delivery — ensuring full compliance with applicable laws and regulations.`,
    benefits: [
      `Complete end-to-end handling by experienced ${isLawyer ? "advocates" : "professionals"}`,
      "Real-time status updates via WhatsApp and email",
      "Document checklist provided upfront",
      "100% online process — no need to visit government offices",
      "Expert review to avoid rejections and deficiencies",
      "Post-service compliance guidance included",
    ],
    eligibility: `Any individual, business, or organization requiring ${serviceName} services.`,
    process: processSteps,
    documentsRequired: documents,
    formsToFill: ["Documents and forms are specific to your matter — full list provided after initial assessment"],
    timeRequired: timeMap[categoryId] || "Subject to government processing times",
    validity: "As applicable to the specific service",
    charges: [
      { item: "Government / statutory fee", amount: "At actuals", note: "Passed through at cost" },
      { item: "Professional service fee", amount: price, note: "Vakil & Co. service charge" },
    ],
    faq: [
      { q: `What documents do I need for ${serviceName}?`, a: "Our team will send you a complete document checklist based on your specific situation after the initial briefing call." },
      { q: "How do I get started?", a: "Click 'Get Started' or 'Consult Now' on this page to fill a brief form. Our team will contact you within 2 hours during business hours." },
      { q: "What is the turnaround time?", a: `${timeMap[categoryId] || "Timelines depend on government processing"}. We will give you an accurate estimate based on your specific case.` },
      { q: "What if my application is rejected or questioned?", a: "We handle all queries, deficiency notices, and objections from government authorities as part of our service at no extra charge for standard queries." },
      { q: "Is my information kept confidential?", a: "Yes. All information you share with Vakil & Co. is strictly confidential and protected by attorney-client privilege. We never share your information with any third party." },
    ],
  };
}

export function getServiceDetail(categoryId: string, slug: string, serviceName: string, price: string, description: string): ServiceDetail {
  const key = `${categoryId}/${slug}`;
  const specific = DETAILS[key];
  const fallback = generateFallback(categoryId, serviceName, price, description);

  if (!specific) return fallback;

  return {
    tagline: specific.tagline ?? fallback.tagline,
    overview: specific.overview ?? fallback.overview,
    benefits: specific.benefits?.length ? specific.benefits : fallback.benefits,
    eligibility: specific.eligibility ?? fallback.eligibility,
    process: specific.process?.length ? specific.process : fallback.process,
    documentsRequired: specific.documentsRequired?.length ? specific.documentsRequired : fallback.documentsRequired,
    formsToFill: specific.formsToFill?.length ? specific.formsToFill : fallback.formsToFill,
    timeRequired: specific.timeRequired ?? fallback.timeRequired,
    validity: specific.validity ?? fallback.validity,
    charges: specific.charges?.length ? specific.charges : fallback.charges,
    faq: specific.faq?.length ? specific.faq : fallback.faq,
  };
}
