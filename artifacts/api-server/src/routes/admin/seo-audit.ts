import { Router, type IRouter } from "express";
import { db, seoSettingsTable } from "@workspace/db";

const router: IRouter = Router();

// ── Default SEO (mirrors DEFAULT_SEO in seo.tsx — title + description only) ──
// These are the effective values shown when a page has no DB override.
const DEFAULT_META: Record<string, { title: string; description: string }> = {
  // Static
  home: { title: "Legal Filing India – Trusted Online Legal Services", description: "India's leading platform for company registration, trademark, GST, tax filing, NGO setup & expert lawyer consultation. 50,000+ clients served." },
  about: { title: "About Legal Filing India – Our Mission & Legal Experts", description: "Learn about Legal Filing India — our experienced team of lawyers, CAs, and CSs dedicated to making quality legal services accessible to every Indian business." },
  contact: { title: "Contact Legal Filing India – Talk to Our Legal Team", description: "Get in touch for company registration, trademark, GST, and all legal services. Call, WhatsApp, or email our expert team. Free callback available." },
  services: { title: "All Legal Services in India | Legal Filing India", description: "Explore 130+ legal services — company registration, GST filing, trademark, NGO setup, property law, immigration, and expert lawyer consultation." },
  lawyers: { title: "Find Expert Lawyers in India | Legal Filing India", description: "Connect with India's top lawyers for criminal, family, corporate, IP, immigration, and labour law cases. Book instant online consultation." },
  blog: { title: "Legal Knowledge Hub – Law, Tax & Compliance Articles", description: "Expert articles on Indian company law, GST updates, trademark tips, startup compliance, and more. Stay legally informed with Legal Filing India." },
  companies: { title: "India Company Search – MCA CIN & Director Lookup", description: "Search 1M+ Indian companies by name, CIN, or director. Access MCA registration details, compliance status, and corporate information instantly." },
  "sitemap-html": { title: "Site Map – Legal Filing India", description: "Complete directory of all pages on Legal Filing India — services, lawyers, blog posts, and company search." },
  // Categories
  "cat/consult-expert": { title: "Online Legal Consultation – Lawyer, CA, CS | India", description: "Instant telephonic or video consultation with qualified advocates, CAs, and Company Secretaries. Expert advice within 30 minutes from ₹999." },
  "cat/business-setup": { title: "Business Registration in India – Company, LLP, OPC", description: "Register your business in India — Private Limited, LLP, OPC, Partnership, Sole Proprietorship. Expert CA/CS support, all-inclusive pricing." },
  "cat/tax-compliance": { title: "GST, Tax Filing & Company Compliance Services India", description: "GST registration, ITR filing, payroll, TDS, ROC compliance, director changes — complete corporate tax and compliance services in India." },
  "cat/trademark-ip": { title: "Trademark Registration & IP Protection in India", description: "Register your trademark, copyright, and patent in India. Protect your brand with expert IP services — search, filing, objection reply & monitoring." },
  "cat/documentation": { title: "Legal Documents & Agreement Drafting Online India", description: "Professionally drafted NDAs, shareholder agreements, employment contracts, rental deeds, legal notices, and 20+ other legal documents from ₹999." },
  "cat/fundraising": { title: "Startup Fundraising & Pitch Deck Services India", description: "Raise funding for your startup with expert fundraising advisory and investor-ready pitch deck creation. Trusted by 500+ Indian startups." },
  "cat/ngo": { title: "NGO Registration – Trust, Society, Section 8 Company", description: "Register your NGO, Trust, Society, or Section 8 Company in India. Get 80G & 12A tax exemptions and CSR eligibility with expert legal support." },
  "cat/property-personal": { title: "Property Law & Personal Legal Services in India", description: "Property registration, title verification, name change, marriage registration, consumer complaints, and immigration services across India." },
  "cat/lawyers": { title: "Top Lawyers in India – Criminal, Family, Corporate Law", description: "Find verified lawyers across India for criminal defence, family disputes, corporate law, IP, labour, banking, and immigration matters." },
  // Consult Expert
  "svc/consult-expert/talk-to-a-lawyer": { title: "Talk to a Lawyer Online in India | ₹999", description: "Get instant telephonic or video legal advice from a qualified advocate for ₹999. Discuss any legal issue — criminal, civil, corporate, or family." },
  "svc/consult-expert/talk-to-a-ca": { title: "Talk to a CA Online – Tax & Finance Advice | ₹999", description: "Consult a Chartered Accountant online for GST, ITR, tax planning, and compliance queries. Expert CA advice within 30 minutes from ₹999." },
  "svc/consult-expert/talk-to-a-cs": { title: "Talk to a Company Secretary Online | ₹999", description: "Expert Company Secretary consultation for MCA filings, ROC compliance, and corporate law. Get instant advice on any secretarial matter." },
  "svc/consult-expert/talk-to-an-ip-trademark-lawyer": { title: "Talk to IP/Trademark Lawyer Online | ₹999", description: "Consult a specialist IP and trademark advocate for brand protection, infringement cases, and patent queries. Online consultation from ₹999." },
  // Business Setup
  "svc/business-setup/private-limited-company": { title: "Private Limited Company Registration India | ₹6,999", description: "Register a Private Limited Company online in India. Expert CA/CS support, DSC, DIN, MOA, AOA, and Certificate of Incorporation. 7–10 working days." },
  "svc/business-setup/limited-liability-partnership": { title: "LLP Registration Online in India | ₹5,999", description: "Register a Limited Liability Partnership in India. Includes LLP agreement drafting, DIN, DSC, and MCA filing. Expert support, 7–10 working days." },
  "svc/business-setup/one-person-company": { title: "One Person Company Registration India | ₹6,499", description: "Register an OPC — perfect for solo entrepreneurs seeking limited liability. Includes MOA, AOA, DSC, DIN, and Certificate of Incorporation." },
  "svc/business-setup/sole-proprietorship": { title: "Sole Proprietorship Registration India | ₹1,999", description: "Quick and simple sole proprietorship registration in India. Ideal for freelancers and small businesses. Includes GST and bank account guidance." },
  "svc/business-setup/nidhi-company": { title: "Nidhi Company Registration in India | ₹24,999", description: "Register a Nidhi Company — a mutual benefit society for members' savings and lending. Includes RBI compliance and all MCA filings." },
  "svc/business-setup/producer-company": { title: "Producer Company Registration India | ₹19,999", description: "Set up a Producer Company for farmers and agricultural cooperatives in India. Full MCA compliance, legal drafting, and registration support." },
  "svc/business-setup/partnership-firm": { title: "Partnership Firm Registration India | ₹2,999", description: "Register a Partnership Firm with a legally binding Partnership Deed. Ideal for traditional businesses and professionals across India." },
  "svc/business-setup/startup-india-registration": { title: "Startup India DPIIT Registration | ₹3,999", description: "Get DPIIT recognition under the Startup India scheme for tax benefits, fast-track IP filing, and access to government funding schemes." },
  "svc/business-setup/us-incorporation": { title: "US Company Registration – Delaware C-Corp & LLC", description: "Incorporate a US company (Delaware C-Corp or LLC) from India. Ideal for startups raising US venture capital or serving American markets." },
  "svc/business-setup/singapore-incorporation": { title: "Singapore Company Registration from India | $499", description: "Set up a Singapore Private Limited Company — low taxes, world-class banking, and Asia market access for Indian entrepreneurs." },
  "svc/business-setup/uk-incorporation": { title: "UK Company Registration from India | £299", description: "Register a UK Limited Company from India. Ideal for accessing UK and EU markets with a credible British business presence." },
  "svc/business-setup/netherlands-incorporation": { title: "Netherlands BV Company Registration | Legal Filing", description: "Set up a Netherlands BV (private limited company). Gateway to the European Union market with full expert legal support from India." },
  "svc/business-setup/hong-kong-incorporation": { title: "Hong Kong Company Registration | Legal Filing India", description: "Register a Private Limited Company in Hong Kong. Low-tax jurisdiction, Asia financial hub, easy banking for Indian businesses going global." },
  "svc/business-setup/dubai-incorporation": { title: "Dubai Company Registration – Mainland & Free Zone UAE", description: "Register a company in Dubai UAE — Mainland, Free Zone, or Offshore. Expert support for Indian entrepreneurs expanding to the Middle East." },
  "svc/business-setup/company-name-search": { title: "Company Name Availability Search India | ₹299", description: "Check if your proposed company or LLP name is available on MCA before filing. Instant search with expert guidance on naming rules." },
  "svc/business-setup/business-name-generator": { title: "AI Business Name Generator – Free | Legal Filing India", description: "Generate unique and brandable business names instantly using AI. Check domain and trademark availability together. 100% free tool." },
  "svc/business-setup/digital-signature-certificate": { title: "Digital Signature Certificate (DSC) India | ₹1,299", description: "Get Class 2 or Class 3 DSC for MCA, income tax, and tender filings. Quick processing, Aadhaar-based verification, doorstep delivery." },
  "svc/business-setup/msme-ssi-registration": { title: "MSME Udyam Registration Online India | ₹1,499", description: "Register your micro, small, or medium enterprise under Udyam (formerly MSME/SSI). Access government benefits, credit schemes, and priority tenders." },
  "svc/business-setup/iso-certification": { title: "ISO Certification India – 9001, 14001, 27001 | ₹9,999", description: "Get ISO 9001 (quality), ISO 14001 (environment), or ISO 27001 (security) certification. Expert consultants guide your complete audit process." },
  "svc/business-setup/fssai-registration": { title: "FSSAI Food License Registration Online | ₹3,999", description: "Apply for FSSAI basic, state, or central food license online. Mandatory for food businesses, restaurants, and cloud kitchens across India." },
  "svc/business-setup/iec-import-export-code": { title: "IEC Import Export Code Registration India | ₹3,499", description: "Get your Import Export Code (IEC) from DGFT to start importing or exporting goods and services from India. Fast online processing." },
  "svc/business-setup/legal-metrology": { title: "Legal Metrology Registration India | ₹4,999", description: "Obtain Legal Metrology registration for packaged goods, weights, and measures compliance under the Legal Metrology Act in India." },
  "svc/business-setup/hallmark-registration": { title: "BIS Hallmark Registration for Jewellery India | ₹3,999", description: "Get BIS hallmarking certification for gold and silver jewellery. Mandatory for all jewellers in India as per BIS hallmarking guidelines." },
  "svc/business-setup/bis-registration": { title: "BIS ISI Mark Registration for Products India | ₹3,999", description: "Get Bureau of Indian Standards (BIS) ISI mark certification. Mandatory for electronics, cement, food, and other regulated goods in India." },
  "svc/business-setup/web-ecommerce-development": { title: "E-Commerce Website Development India | Legal Filing", description: "Professional e-commerce and business website development for Indian businesses. Complete setup including domain, hosting, and payment gateway." },
  // Tax & Compliance
  "svc/tax-compliance/gst-registration": { title: "GST Registration Online in India | ₹1,499", description: "Register for GST online in India. Expert CA support, Aadhaar verification, document preparation, and GSTIN in 3–7 working days." },
  "svc/tax-compliance/gst-filing": { title: "GST Return Filing Online India | ₹999/month", description: "Monthly and quarterly GST return filing (GSTR-1, GSTR-3B, GSTR-9) by expert CAs. Timely filing, zero late fees, full compliance." },
  "svc/tax-compliance/gst-advisory": { title: "GST Consulting & Advisory Services India", description: "Expert GST advisory for input tax credit, place of supply, reverse charge, e-invoicing, and audit compliance for Indian businesses." },
  "svc/tax-compliance/indirect-tax": { title: "Indirect Tax Compliance Services India", description: "Comprehensive indirect tax services — customs duty, excise, and GST. Expert support for manufacturing and trading companies across India." },
  "svc/tax-compliance/rodtep": { title: "RoDTEP Scheme Registration & Compliance India", description: "Claim Remission of Duties and Taxes on Exported Products (RoDTEP) — duty remission on exports with expert legal and tax support." },
  "svc/tax-compliance/add-a-director": { title: "Add a Director to Company in India | ₹2,999", description: "Add a new director to your Private Limited Company or OPC. Includes DIN application, DIR-12 MCA filing, and board resolution drafting." },
  "svc/tax-compliance/remove-a-director": { title: "Remove a Director from Company India | ₹2,999", description: "Legally remove or resign a director from your company. Includes MCA DIR-12 filing, board resolution, and full ROC compliance." },
  "svc/tax-compliance/increase-authorized-capital": { title: "Increase Authorized Capital India | ₹3,999", description: "Increase your company's authorized share capital. Includes SH-7 MCA filing, board resolution, EGM notice, and MGT-14 compliance." },
  "svc/tax-compliance/close-pvt-ltd-company": { title: "Close / Strike Off Pvt Ltd Company India | ₹7,999", description: "Close your Private Limited Company via STK-2 fast track or voluntary winding up. Expert support to clear liabilities and complete MCA filing." },
  "svc/tax-compliance/change-objective-activity": { title: "Change Company Objective / Activity India | ₹3,999", description: "Amend your company's main object clause (MOA) with MCA approval. Includes EGM notice, board resolution, and MGT-14 filing." },
  "svc/tax-compliance/change-address": { title: "Change Registered Office Address India | ₹2,999", description: "Change your company's registered address within the same state or to a new state. Includes INC-22 / INC-23 MCA filing and board resolution." },
  "svc/tax-compliance/change-company-name": { title: "Change Company Name in India | ₹3,999", description: "Change your Private Limited, OPC, or LLP name. Includes name availability check, EGM, MNC-1, and INC-24 MCA filing." },
  "svc/tax-compliance/add-designated-partner": { title: "Add Designated Partner in LLP India | ₹2,499", description: "Add a new Designated Partner to your LLP. Includes DIN, consent form, supplementary LLP agreement, and Form 4 MCA filing." },
  "svc/tax-compliance/changes-to-llp-agreement": { title: "LLP Agreement Amendment in India | ₹2,999", description: "Amend your LLP Agreement for profit sharing, partner rights, or other changes. Includes supplementary deed and Form 3 MCA filing." },
  "svc/tax-compliance/close-the-llp": { title: "Close / Wind Up LLP in India | ₹5,999", description: "Strike off or wind up your LLP — includes Form 24 application, NOC from creditors, indemnity bond, and complete ROC filing." },
  "svc/tax-compliance/pvt-ltd-opc-compliance": { title: "Annual ROC Compliance – Pvt Ltd / OPC | ₹5,999", description: "Complete annual ROC compliance for Private Limited and OPC — AOC-4 (financials), MGT-7 (annual return), DIR-3 KYC, and statutory audit." },
  "svc/tax-compliance/llp-compliance": { title: "Annual LLP Compliance – Form 8 & 11 | ₹3,999", description: "Complete annual LLP compliance — Form 8 (statement of accounts), Form 11 (annual return), and income tax return filing by expert CAs." },
  "svc/tax-compliance/pf-registration": { title: "Provident Fund (EPF) Registration India | ₹3,499", description: "Register your company for Employees' Provident Fund (EPF) compliance. Mandatory for businesses with 20+ employees across India." },
  "svc/tax-compliance/esi-registration": { title: "ESI Registration for Employers India | ₹2,999", description: "Register for Employees' State Insurance (ESI) — mandatory for businesses with 10+ employees. Expert CA support for full ESIC compliance." },
  "svc/tax-compliance/professional-tax-registration": { title: "Professional Tax Registration India | ₹1,999", description: "Register for Professional Tax (PT) as an employer. Mandatory in Maharashtra, Karnataka, West Bengal, and other states. Includes PT return filing." },
  "svc/tax-compliance/shops-establishments-license": { title: "Shops & Establishments License India | ₹2,499", description: "Get Shops & Establishments Act registration for your office, shop, or establishment. State-wise expert support across all Indian states." },
  "svc/tax-compliance/esop": { title: "ESOP Scheme Setup for Indian Companies | ₹9,999", description: "Design and implement an Employee Stock Option Plan (ESOP) — scheme drafting, SEBI compliance, valuation, and MCA filing for Indian companies." },
  "svc/tax-compliance/posh-compliance": { title: "POSH Act Compliance for Companies India | ₹7,999", description: "Ensure POSH compliance — Internal Complaints Committee formation, policy drafting, employee training, and annual report preparation." },
  "svc/tax-compliance/accounting-book-keeping": { title: "Accounting & Bookkeeping Services India | ₹3,999", description: "Monthly accounting, bookkeeping, and financial statement preparation by expert CAs. Tally, QuickBooks, Zoho — all accounting software supported." },
  "svc/tax-compliance/payroll-maintenance": { title: "Payroll Processing Services India | ₹3,999/month", description: "End-to-end payroll processing — salary slips, PF, ESI, PT, TDS deductions, and Form 16 for all your employees. Accurate and on time." },
  "svc/tax-compliance/tds-return-filing": { title: "TDS Return Filing – 24Q, 26Q, 27Q India | ₹2,999", description: "Quarterly TDS return filing (24Q, 26Q, 27Q, 27EQ) by expert CAs. Avoid penalties with timely, accurate e-TDS return submission." },
  "svc/tax-compliance/individual-income-tax-filing": { title: "Income Tax Return (ITR) Filing India | ₹1,499", description: "File your ITR-1 to ITR-7 online with expert CA support. For salaried, business income, capital gains, and HUF — accurate and timely." },
  "svc/tax-compliance/proprietorship-tax-return": { title: "Proprietorship Income Tax Return India | ₹2,999", description: "Expert CA-assisted income tax return filing for sole proprietors and self-employed individuals in India. ITR-3 and ITR-4 filing." },
  "svc/tax-compliance/income-tax-notice": { title: "Income Tax Notice Response India | ₹4,999", description: "Expert legal and CA support to respond to income tax department notices — scrutiny, demand, defective return, and 143(1) intimations." },
  "svc/tax-compliance/proprietorship-to-pvt-ltd": { title: "Convert Proprietorship to Pvt Ltd India | ₹11,999", description: "Convert your sole proprietorship into a Private Limited Company with expert legal support for slump sale, asset transfer, and MCA registration." },
  "svc/tax-compliance/secretarial-audit": { title: "Secretarial Audit & Compliance Check India | ₹14,999", description: "Identify and fix compliance gaps with a comprehensive secretarial audit covering MCA, SEBI, RBI, and labour law compliance for companies." },
  "svc/tax-compliance/due-diligence": { title: "Legal & Financial Due Diligence Services India", description: "Expert legal and financial due diligence for M&A transactions, investments, and business acquisitions. Comprehensive risk assessment reports." },
  "svc/tax-compliance/partnership-to-llp": { title: "Convert Partnership Firm to LLP India | ₹9,999", description: "Convert your Partnership Firm to a Limited Liability Partnership. Expert legal support for consent, tax NOC, and MCA Form 17 filing." },
  "svc/tax-compliance/private-to-public": { title: "Convert Pvt Ltd to Public Limited Company India", description: "Convert your Private Limited Company to a Public Limited Company. Includes EGM, MOA/AOA amendment, and SEBI/RBI compliance if applicable." },
  "svc/tax-compliance/private-to-opc": { title: "Convert Private Limited to OPC India | ₹7,999", description: "Convert your Private Limited Company to a One Person Company when you're the sole shareholder. Includes INC-6 MCA filing and compliance." },
  "svc/tax-compliance/rbi-compliance": { title: "RBI Compliance – FEMA, FDI, ECB Services India", description: "Expert support for RBI and FEMA compliance — FDI reporting, External Commercial Borrowings, ODI, LRS, and FCGPR filings for Indian companies." },
  // Trademark & IP
  "svc/trademark-ip/trademark-registration": { title: "Trademark Registration Online India | ₹1,999", description: "Register your brand name, logo, or tagline as a trademark in India. Expert search, TM-A filing, and prosecution by IP attorneys. All classes." },
  "svc/trademark-ip/search-for-trademark": { title: "Trademark Search India – All Classes | ₹499", description: "Comprehensive trademark availability search across all 45 classes in the Indian trademark registry. Avoid infringement and application rejection." },
  "svc/trademark-ip/respond-to-tm-objection": { title: "Trademark Objection Reply India | ₹2,499", description: "Expert response to trademark examiner's objections — absolute grounds, relative grounds, and TM office hearings. High success rate." },
  "svc/trademark-ip/well-known-trademark": { title: "Well Known Trademark Status India | Legal Filing", description: "Apply for 'Well Known Trademark' recognition for famous brands in India — enhanced protection across all 45 classes by expert IP attorneys." },
  "svc/trademark-ip/trademark-watch": { title: "Trademark Watch & Monitoring Service | ₹3,999/yr", description: "Monitor your registered trademark for infringements, identical/similar new filings, and unauthorized use across the Indian trademark registry." },
  "svc/trademark-ip/trademark-renewal": { title: "Trademark Renewal in India | ₹1,499", description: "Renew your registered trademark before it expires (every 10 years). Includes TM-R application, registry follow-up, and renewal certificate." },
  "svc/trademark-ip/trademark-assignment": { title: "Trademark Assignment / Transfer India | ₹4,999", description: "Transfer ownership of your registered trademark to another party. Includes assignment deed drafting, TM-P application, and registry follow-up." },
  "svc/trademark-ip/usa-trademark": { title: "USA Trademark Registration from India | $399", description: "Register your trademark in the United States with USPTO. Expert Indian IP attorneys handle the full application and office action response." },
  "svc/trademark-ip/international-trademark": { title: "International Trademark – Madrid Protocol India", description: "Protect your brand globally under the Madrid Protocol. Single application covers 130+ countries through WIPO. Expert Indian IP attorneys." },
  "svc/trademark-ip/logo-design": { title: "Professional Logo Design India | ₹3,499", description: "Get a unique, brand-ready logo designed by professional designers. Includes 3 concepts, unlimited revisions, and print & digital-ready files." },
  "svc/trademark-ip/copyright-registration": { title: "Copyright Registration Online India | ₹2,999", description: "Protect your original work — books, music, software, art, films, and websites — with official copyright registration in India." },
  "svc/trademark-ip/indian-patent-search": { title: "Indian Patent Search Service | ₹4,999", description: "Comprehensive prior art and novelty search in the Indian Patent Office database before filing your patent application. Detailed search report." },
  "svc/trademark-ip/provisional-application": { title: "Provisional Patent Application India | ₹14,999", description: "Secure your invention's priority date with a provisional patent application. 12 months to develop the invention before complete specification filing." },
  "svc/trademark-ip/permanent-patent": { title: "Complete Patent Registration in India | ₹29,999", description: "Full patent filing — complete specification, claims drafting, drawings, prosecution, and examination response by expert patent attorneys in India." },
  "svc/trademark-ip/copyright-infringement": { title: "Copyright Infringement Legal Action India", description: "Legal representation for copyright infringement cases — DMCA takedowns, civil suits, criminal complaints, and Anton Piller orders in India." },
  "svc/trademark-ip/patent-infringement": { title: "Patent Infringement Legal Services India", description: "Expert legal support for patent infringement disputes — cease and desist, injunctions, and litigation before IP courts and High Courts in India." },
  "svc/trademark-ip/trademark-infringement": { title: "Trademark Infringement Legal Action India", description: "Stop unauthorized use of your brand. Expert legal support for cease and desist notices, TM oppositions, and IP court litigation in India." },
  "svc/trademark-ip/design-registration": { title: "Industrial Design Registration India | ₹6,999", description: "Protect the unique visual design of your product under the Designs Act. Expert support for design filing and prosecution at the Patent Office." },
  // Documentation
  "svc/documentation/nda": { title: "NDA Drafting – Non-Disclosure Agreement India | ₹999", description: "Legally binding NDA drafted by expert lawyers — mutual and one-way NDAs for employees, vendors, investors, and business partners in India." },
  "svc/documentation/sla": { title: "Service Level Agreement (SLA) Drafting India | ₹1,499", description: "Professional SLA drafting covering uptime, response time, penalties, and exit clauses. Suitable for IT, cloud, and service businesses in India." },
  "svc/documentation/franchise-agreement": { title: "Franchise Agreement Drafting India | ₹3,999", description: "Expert franchise agreement drafting — franchisee rights, territory, royalties, IP licensing, and termination clauses for Indian businesses." },
  "svc/documentation/master-service-agreement": { title: "Master Service Agreement (MSA) India | ₹2,999", description: "Professionally drafted MSA covering scope, payment, IP ownership, liability, and confidentiality for long-term service relationships in India." },
  "svc/documentation/shareholders-agreement": { title: "Shareholders Agreement Drafting India | ₹4,999", description: "Protect founder rights with a comprehensive SHA — voting rights, anti-dilution, drag-along, tag-along, and exit provisions for Indian companies." },
  "svc/documentation/joint-venture-agreement": { title: "Joint Venture Agreement Drafting India | ₹3,999", description: "Professionally drafted JV agreement covering contributions, governance, profit sharing, IP rights, and exit provisions for joint ventures in India." },
  "svc/documentation/founders-agreement": { title: "Founders Agreement Drafting India | ₹2,999", description: "Protect co-founders with a comprehensive agreement — equity splits, vesting schedule, IP assignment, roles, and departure clauses." },
  "svc/documentation/vendor-agreement": { title: "Vendor / Supplier Agreement Drafting India | ₹1,999", description: "Professionally drafted vendor agreements covering supply terms, payment, quality standards, IP ownership, and dispute resolution." },
  "svc/documentation/consultancy-agreement": { title: "Consultancy Agreement Drafting India | ₹1,499", description: "Expert drafting of consultancy contracts covering scope of work, fees, IP ownership, confidentiality, and termination for Indian consultants." },
  "svc/documentation/mou": { title: "MOU Drafting – Memorandum of Understanding India", description: "Professionally drafted MOU for business partnerships, collaborations, and pre-contract arrangements. Non-binding and binding options available." },
  "svc/documentation/make-a-will": { title: "Will Drafting & Registration in India | ₹2,999", description: "Get your Will professionally drafted by lawyers. Covers property, assets, and nominees. Optional registration for stronger legal validity." },
  "svc/documentation/power-of-attorney": { title: "Power of Attorney Drafting India | ₹1,999", description: "Expert drafting of General, Special, or Property POA. Notarized and apostilled if required. Valid for NRIs and Indian residents." },
  "svc/documentation/terms-of-service": { title: "Terms of Service Drafting India | ₹1,499", description: "Expert drafting of Terms of Service for websites, apps, and e-commerce platforms. Compliant with India's IT Act and consumer protection rules." },
  "svc/documentation/gdpr": { title: "GDPR Compliance for Indian Businesses | ₹4,999", description: "GDPR compliance advisory and documentation for Indian companies handling EU customer data — privacy policy, DPA, and data mapping." },
  "svc/documentation/disclaimer": { title: "Disclaimer Drafting for Websites India | ₹999", description: "Legally worded disclaimer for websites, apps, blogs, and financial advisors to limit liability and protect against legal claims in India." },
  "svc/documentation/scope-of-work": { title: "Scope of Work Agreement Drafting India | ₹1,499", description: "Professionally drafted Scope of Work and Deliverables Agreement for projects, freelancers, and agencies in India. Clear deliverables and timelines." },
  "svc/documentation/rental-agreement": { title: "Rental Agreement Drafting India | ₹999", description: "Legal rental/lease agreement drafting for residential and commercial property across India. 11-month licence and long-term lease formats available." },
  "svc/documentation/sale-deed": { title: "Sale Deed Drafting & Registration India | ₹2,999", description: "Professionally drafted property Sale Deed with all mandatory clauses. Expert support for registration and stamp duty computation across India." },
  "svc/documentation/legal-notice": { title: "Legal Notice Drafting & Sending India | ₹1,999", description: "Expert lawyers draft and send legal notices for contract breach, property disputes, money recovery, and defamation via registered post." },
  "svc/documentation/legal-notice-recovery": { title: "Legal Notice for Money Recovery India | ₹1,999", description: "Send a legally drafted notice for recovery of dues, loans, or outstanding payments. Expert advocates with 48-hour turnaround." },
  "svc/documentation/cheque-bounce-notice": { title: "Cheque Bounce Notice India – Section 138 | ₹1,999", description: "Expert legal notice for cheque dishonour under Section 138 NI Act. Includes demand notice drafting and court complaint filing if required." },
  "svc/documentation/employment-agreement": { title: "Employment Agreement Drafting India | ₹1,499", description: "Comprehensive employment contracts for permanent, contractual, and part-time staff. Covers NDA, IP assignment, non-compete, and notice period." },
  // Fundraising
  "svc/fundraising/fundraising": { title: "Startup Fundraising Advisory India | Legal Filing", description: "Expert fundraising advisory for seed, Series A, and growth stage startups — term sheet review, SAFE notes, and investor due diligence support." },
  "svc/fundraising/pitch-deck": { title: "Investor Pitch Deck Creation India | Legal Filing", description: "Professional investor pitch deck design and content for Indian startups. Compelling storytelling, financial projections, and market analysis." },
  // NGO
  "svc/ngo/ngo": { title: "NGO Registration in India | Society, Trust, Sec. 8", description: "Register your NGO in India — choose Society, Trust, or Section 8 Company. Expert legal support, Darpan registration, and 80G/12A tax exemption." },
  "svc/ngo/section-8-company": { title: "Section 8 Company Registration India | ₹9,999", description: "Register a Section 8 Not-for-Profit Company under the Companies Act. Tax exemptions, high credibility, perpetual succession for NGOs." },
  "svc/ngo/trust-registration": { title: "Trust Registration in India | ₹6,999", description: "Register a Public or Private Charitable Trust in India. Expert support for trust deed drafting, registration, and PAN application." },
  "svc/ngo/society-registration": { title: "Society Registration in India | ₹4,999", description: "Register a society under the Societies Registration Act for cultural, educational, and religious organizations across India." },
  "svc/ngo/ngo-compliance": { title: "NGO Annual Compliance – FCRA, ITR | ₹5,999", description: "Complete annual compliance for NGOs — FCRA renewal, Form FC-4, income tax return, Darpan update, and 80G/12A renewal by expert CAs." },
  "svc/ngo/section-8-compliance": { title: "Section 8 Company Annual Compliance India | ₹4,999", description: "Annual compliance for Section 8 Not-for-Profit companies — AOC-4, MGT-7, statutory audit, and income tax return by expert CAs." },
  "svc/ngo/csr-1-filing": { title: "CSR-1 Form Filing for NGOs India | ₹2,999", description: "File CSR-1 to register your NGO or trust to receive Corporate Social Responsibility funds from Indian companies under Section 135." },
  "svc/ngo/80g-12a": { title: "80G & 12A Tax Exemption for NGOs India | ₹3,999", description: "Get Sec. 80G and Sec. 12A tax exemption certificates. Allows donors to claim deductions and your NGO to be fully tax-exempt." },
  "svc/ngo/darpan-registration": { title: "NGO Darpan Registration India | ₹1,999", description: "Register your NGO on the NITI Aayog Darpan portal — mandatory for receiving government grants and CSR funds from corporates." },
  // Property & Personal
  "svc/property-personal/property-title-verification": { title: "Property Title Verification India | ₹2,999", description: "Comprehensive property title verification by expert lawyers — encumbrance certificate, chain of title, and clear ownership report before purchase." },
  "svc/property-personal/property-registration": { title: "Property Registration in India | ₹3,999", description: "Expert support for property sale deed registration across India — stamp duty calculation, deed drafting, and sub-registrar appointment." },
  "svc/property-personal/name-change": { title: "Legal Name Change in India – Gazette | ₹1,999", description: "Change your name legally in India — affidavit, newspaper publication, Gazette of India notification, and Aadhaar, PAN, and passport update." },
  "svc/property-personal/religion-change": { title: "Religion Change Declaration India | ₹1,499", description: "Legally declare a change of religion in India — affidavit drafting, newspaper publication, and district court submission support." },
  "svc/property-personal/gender-change": { title: "Gender Change Legal Process India | Legal Filing", description: "Legal support for gender change in official documents — court declaration, Aadhaar, PAN, passport, and voter ID update guidance." },
  "svc/property-personal/online-police-complaint": { title: "File Online Police Complaint India | Legal Filing", description: "Expert guidance to file an online FIR or complaint with Indian police authorities. Lawyer-drafted complaint with 48-hour turnaround." },
  "svc/property-personal/marriage-registration": { title: "Marriage Registration in India | ₹1,999", description: "Register your marriage under the Hindu Marriage Act or Special Marriage Act. All Indian states covered with document-based registration." },
  "svc/property-personal/court-marriage": { title: "Court Marriage in India | ₹2,999", description: "Register a court marriage under the Special Marriage Act. Includes notice filing, 30-day period, and official marriage certificate issuance." },
  "svc/property-personal/corporate-immigration": { title: "Corporate Immigration Services India | Legal Filing", description: "Work visas, business visas, and residence permits for Indian companies bringing foreign talent or Indian executives working abroad." },
  "svc/property-personal/family-immigration": { title: "Family Immigration Services India | Legal Filing", description: "Spouse visas, dependent visas, and family reunification services for Indians migrating abroad or bringing family to India." },
  "svc/property-personal/college-immigration": { title: "Student Visa & College Immigration India | Legal", description: "Expert support for student visas, university admission documentation, and college immigration to USA, UK, Canada, and Australia." },
  "svc/property-personal/online-consumer-complaint": { title: "File Consumer Complaint Online India | ₹1,999", description: "Expert lawyers file consumer complaints on the National Consumer Helpline and NCDRC portal for product defects and service deficiency." },
  "svc/property-personal/ecommerce-consumer-complaint": { title: "E-Commerce Consumer Complaint India | ₹1,999", description: "Legal support to file consumer complaints against Amazon, Flipkart, Meesho, and other e-commerce platforms for fraud or defective products." },
  "svc/property-personal/insurance-consumer-complaint": { title: "Insurance Consumer Complaint India | ₹1,999", description: "File a legal complaint against insurance companies for claim rejection, delay, and mis-selling before IRDAI or consumer forums in India." },
  "svc/property-personal/consumer-protection-act": { title: "Consumer Protection Act Legal Help India | ₹2,999", description: "Expert legal guidance on Consumer Protection Act 2019 — file complaints for unfair trade practices, product liability, and e-commerce fraud." },
  // Lawyers
  "svc/lawyers/criminal-lawyer": { title: "Criminal Lawyer in India – Bail & Defence | Legal", description: "Hire expert criminal defence lawyers for bail, FIR quashing, trial defence, and appeals across all courts in India. Free first consultation." },
  "svc/lawyers/labour-lawyer": { title: "Labour & Employment Lawyer India | Legal Filing", description: "Expert labour lawyers for wrongful termination, PF disputes, factory act compliance, and industrial tribunal cases across India." },
  "svc/lawyers/consumer-court-lawyer": { title: "Consumer Court Lawyer India | Legal Filing India", description: "Experienced consumer court advocates for district, state, and national consumer disputes. Defective products, services, and unfair trade practices." },
  "svc/lawyers/divorce-lawyer": { title: "Divorce Lawyer in India – Online & In-Person", description: "Experienced divorce and family lawyers for mutual consent divorce, contested divorce, maintenance, and child custody across India." },
  "svc/lawyers/banking-lawyer": { title: "Banking & Finance Lawyer India | Legal Filing India", description: "Expert banking lawyers for NPA recovery, SARFAESI proceedings, DRT cases, loan fraud, and banking regulatory compliance in India." },
  "svc/lawyers/immigration-lawyer": { title: "Immigration Lawyer India – Visa & PR Services", description: "Expert immigration lawyers for visa applications, permanent residency, citizenship renunciation, and OCI card services across India." },
  "svc/lawyers/family-lawyer": { title: "Family Lawyer in India – Matrimonial & Succession", description: "Expert family lawyers for divorce, maintenance, child custody, succession, domestic violence, and matrimonial disputes across India." },
  "svc/lawyers/litigation-lawyer": { title: "Litigation Lawyer India – Civil & Commercial Courts", description: "Experienced civil and commercial litigation lawyers for contract disputes, injunctions, arbitration, and High Court/Supreme Court representation." },
  "svc/lawyers/ip-lawyer": { title: "Intellectual Property Lawyer India | Legal Filing", description: "Expert IP lawyers for trademark, copyright, and patent disputes, licensing negotiations, and IP due diligence across Indian courts." },
  "svc/lawyers/trademark-lawyer": { title: "Trademark Lawyer in India | ₹999 Consultation", description: "Specialist trademark attorneys for registration, opposition, objection reply, infringement cases, and brand protection across India." },
  "svc/lawyers/tmt": { title: "Technology, Media & Telecom Lawyer India | TMT Law", description: "Expert TMT lawyers for software licensing, data privacy, broadcasting regulations, telecom disputes, and IT Act compliance in India." },
  "svc/lawyers/risk-management": { title: "Risk Management & Regulatory Lawyer India", description: "Expert legal support for corporate risk management, regulatory compliance, RBI/SEBI matters, and enterprise risk advisory for Indian companies." },
};

// ── Known pages (same list as ALL_PAGES in seo.tsx) ─────────────────────────
interface KnownPage { id: string; label: string; group: "static" | "category" | "service"; }

const KNOWN_PAGES: KnownPage[] = Object.keys(DEFAULT_META).map(id => ({
  id,
  label: DEFAULT_META[id]?.title?.split("–")[0]?.split("|")[0]?.trim() ?? id,
  group: id.startsWith("svc/") ? "service" : id.startsWith("cat/") ? "category" : "static",
}));

// ── Audit types ──────────────────────────────────────────────────────────────
export type AuditIssueType =
  | "missing_title"
  | "missing_description"
  | "title_too_short"
  | "description_too_short"
  | "duplicate_title";

export interface AuditIssue {
  type: AuditIssueType;
  severity: "error" | "warning";
  message: string;
}

export interface AuditRow {
  pageId: string;
  label: string;
  group: "static" | "category" | "service";
  effectiveTitle: string;
  effectiveDescription: string;
  hasDbRecord: boolean;
  issues: AuditIssue[];
}

export interface AuditResult {
  rows: AuditRow[];
  errorCount: number;
  warningCount: number;
  totalPages: number;
  checkedAt: string;
}

// ── GET /admin/seo/audit ──────────────────────────────────────────────────────
router.get("/admin/seo/audit", async (_req, res): Promise<void> => {
  const dbRecords = await db.select().from(seoSettingsTable);
  const dbMap = new Map(dbRecords.map(r => [r.page, r]));

  // Build rows with effective title/description (DB override OR default)
  const rows: AuditRow[] = KNOWN_PAGES.map(page => {
    const rec = dbMap.get(page.id);
    const defaults = DEFAULT_META[page.id] ?? { title: "", description: "" };
    const effectiveTitle = (rec?.title ?? "").trim() || defaults.title;
    const effectiveDescription = (rec?.description ?? "").trim() || defaults.description;
    return {
      pageId: page.id,
      label: page.label,
      group: page.group,
      effectiveTitle,
      effectiveDescription,
      hasDbRecord: dbMap.has(page.id),
      issues: [],
    };
  });

  // Also include orphan DB records not in KNOWN_PAGES (custom/unknown pages)
  const knownIds = new Set(KNOWN_PAGES.map(p => p.id));
  for (const rec of dbRecords) {
    if (knownIds.has(rec.page)) continue;
    const effectiveTitle = (rec.title ?? "").trim();
    const effectiveDescription = (rec.description ?? "").trim();
    rows.push({
      pageId: rec.page,
      label: rec.page,
      group: "static",
      effectiveTitle,
      effectiveDescription,
      hasDbRecord: true,
      issues: [],
    });
  }

  // Detect duplicate titles across all pages
  const titlePageMap = new Map<string, string[]>(); // normalised title → [pageId, ...]
  for (const row of rows) {
    const key = row.effectiveTitle.toLowerCase();
    if (key) {
      const existing = titlePageMap.get(key) ?? [];
      existing.push(row.pageId);
      titlePageMap.set(key, existing);
    }
  }
  const duplicateTitles = new Set<string>(
    [...titlePageMap.entries()].filter(([, ids]) => ids.length > 1).map(([key]) => key)
  );

  // Flag issues
  for (const row of rows) {
    const issues: AuditIssue[] = [];

    if (!row.effectiveTitle) {
      issues.push({ type: "missing_title", severity: "error", message: "No meta title set (no default either)" });
    } else if (row.effectiveTitle.length < 30) {
      issues.push({ type: "title_too_short", severity: "warning", message: `Title is ${row.effectiveTitle.length} chars (min 30 recommended)` });
    }

    if (!row.effectiveDescription) {
      issues.push({ type: "missing_description", severity: "error", message: "No meta description set (no default either)" });
    } else if (row.effectiveDescription.length < 80) {
      issues.push({ type: "description_too_short", severity: "warning", message: `Description is ${row.effectiveDescription.length} chars (min 80 recommended)` });
    }

    const titleKey = row.effectiveTitle.toLowerCase();
    if (titleKey && duplicateTitles.has(titleKey)) {
      const others = (titlePageMap.get(titleKey) ?? []).filter(id => id !== row.pageId);
      issues.push({
        type: "duplicate_title",
        severity: "error",
        message: `Duplicate title shared with: ${others.slice(0, 3).join(", ")}${others.length > 3 ? " …" : ""}`,
      });
    }

    row.issues = issues;
  }

  // Only return rows with issues
  const issueRows = rows.filter(r => r.issues.length > 0);
  const errorCount = issueRows.reduce((n, r) => n + r.issues.filter(i => i.severity === "error").length, 0);
  const warningCount = issueRows.reduce((n, r) => n + r.issues.filter(i => i.severity === "warning").length, 0);

  const result: AuditResult = {
    rows: issueRows,
    errorCount,
    warningCount,
    totalPages: rows.length,
    checkedAt: new Date().toISOString(),
  };

  res.json(result);
});

export default router;
