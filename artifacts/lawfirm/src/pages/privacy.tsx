import { Helmet } from "react-helmet-async";
import { Shield } from "lucide-react";

const sections = [
  { title: "1. Information We Collect", content: `We collect information you provide directly to us, such as when you create an account, submit a consultation request, or contact us. This may include:\n\n• Personal identification information (name, email address, phone number)\n• Business information (company name, GSTIN, business registration details)\n• Legal matter details you share in connection with our services\n• Payment and billing information processed securely via our payment partners\n• Communications you send us, including emails and messages\n\nWe also automatically collect certain technical information when you visit our website, including IP addresses, browser type, operating system, pages visited, and time spent on pages.` },
  { title: "2. How We Use Your Information", content: `We use the information we collect to:\n\n• Provide, maintain, and improve our legal services\n• Process and fulfill your service requests and consultations\n• Send you service-related communications, invoices, and updates\n• Respond to your comments, questions, and requests\n• Send promotional communications (with your consent, and you may opt out at any time)\n• Monitor and analyse usage patterns and trends\n• Detect and prevent fraudulent transactions and other illegal activities\n• Comply with our legal obligations, including professional conduct rules applicable to legal practitioners` },
  { title: "3. Information Sharing and Disclosure", content: `We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:\n\n• With your explicit consent\n• With service providers who assist us in delivering our services (e.g., payment processors, cloud storage), under strict confidentiality obligations\n• With courts, tribunals, regulatory authorities, or opposing parties as required by law or in connection with your legal matter\n• In connection with a merger, acquisition, or sale of business assets, with appropriate confidentiality protections\n• To protect the rights, property, or safety of Legal Filing India, our clients, or others\n\nAll third-party service providers are contractually required to maintain confidentiality and use your information solely for the purposes specified.` },
  { title: "4. Attorney-Client Privilege", content: `Information shared with our lawyers in connection with a legal matter is protected by attorney-client privilege under the Bar Council of India Rules and applicable laws. We maintain strict protocols to preserve the confidentiality of privileged communications.\n\nNote: Using our website or submitting a contact form does not, by itself, create an attorney-client relationship. Such a relationship is established only upon execution of an engagement letter.` },
  { title: "5. Data Security", content: `We implement industry-standard security measures to protect your information, including:\n\n• TLS encryption for all data transmitted via our website and portal\n• End-to-end encryption for sensitive client communications\n• Role-based access controls limiting internal access to your data\n• Regular security audits and penetration testing\n• Secure data centres with SOC 2 Type II certification\n\nWhile we strive to protect your information, no security system is completely infallible. We encourage you to use strong passwords and exercise caution when sharing sensitive information online.` },
  { title: "6. Data Retention", content: `We retain your personal information for as long as necessary to fulfil the purposes for which it was collected, including:\n\n• Active client data: For the duration of our engagement plus 7 years (as required by professional rules)\n• Enquiry and contact data: 2 years from last contact\n• Analytics and log data: 12 months\n\nYou may request deletion of your data at any time, subject to our legal and professional obligations to retain certain records.` },
  { title: "7. Your Rights", content: `Under applicable Indian privacy laws (including the Digital Personal Data Protection Act, 2023), you have the right to:\n\n• Access the personal data we hold about you\n• Correct inaccurate or incomplete personal data\n• Request deletion of your personal data (subject to legal retention requirements)\n• Withdraw consent for processing based on consent\n• Raise grievances with our Data Protection Officer\n\nTo exercise these rights, contact us at privacy@legalfilingindia.com.` },
  { title: "8. Cookies and Tracking", content: `Our website uses cookies and similar tracking technologies to enhance your experience. Cookies we use include:\n\n• Essential cookies: Required for the website to function (e.g., session management)\n• Analytics cookies: Help us understand how visitors use our site (e.g., page views, traffic sources)\n• Preference cookies: Remember your settings and preferences\n\nYou can control cookies through your browser settings. Disabling certain cookies may affect website functionality.` },
  { title: "9. Third-Party Links", content: `Our website may contain links to third-party websites, including MCA, government portals, and legal databases. We are not responsible for the privacy practices of these websites. We encourage you to review their privacy policies before providing any information.` },
  { title: "10. Updates to This Policy", content: `We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page with a revised "Last Updated" date. Your continued use of our services after such changes constitutes your acceptance of the updated policy.` },
  { title: "11. Contact Us", content: `For questions, concerns, or requests related to this Privacy Policy, contact our Data Protection Officer:\n\nLegal Filing India India's Trusted Filing Platform\nLevel 7, Capital Building, BKC, Bandra East\nMumbai - 400051, Maharashtra, India\n\nEmail: privacy@legalfilingindia.com\nPhone: 1800-123-4567 (Toll Free)\nWorking Hours: Monday to Friday, 9:30 AM – 6:00 PM IST` },
];

export default function PrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — Legal Filing India</title>
        <meta name="description" content="Legal Filing India Privacy Policy — How we collect, use, and protect your personal information." />
      </Helmet>

      <section className="bg-[#0f2044] text-white py-16 px-4 text-center">
        <div className="container mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-[#c9a227]/20 text-[#c9a227] px-4 py-1.5 rounded-full text-sm font-medium mb-5"><Shield size={14} />Legal Documents</div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-white/60 text-sm">Last Updated: July 2026 · Effective from: July 1, 2026</p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="bg-[#0f2044]/5 border border-[#0f2044]/10 rounded-2xl p-5 mb-10 text-sm text-gray-600">
            <strong className="text-[#0f2044]">Summary:</strong> Legal Filing India is committed to protecting your privacy. We collect only the data needed to provide legal services, never sell your information, protect attorney-client privilege, and give you control over your data. For full details, read the policy below.
          </div>

          <div className="space-y-10">
            {sections.map(s => (
              <div key={s.title}>
                <h2 className="font-bold text-[#0f2044] text-lg mb-3">{s.title}</h2>
                <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{s.content}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
