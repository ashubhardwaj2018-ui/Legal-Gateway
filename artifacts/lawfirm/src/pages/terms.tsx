import { Helmet } from "react-helmet-async";
import { FileText } from "lucide-react";

const sections = [
  { title: "1. Acceptance of Terms", content: `By accessing or using the website and services of Vakil & Co. Legal Associates ("Vakil & Co.", "we", "us", or "our"), you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms, please do not use our services.\n\nThese Terms apply to all visitors, users, and clients of our website located at vakilco.in and any associated sub-domains, applications, or services.` },
  { title: "2. No Attorney-Client Relationship", content: `IMPORTANT: Use of this website, submission of contact forms, or any communication via this website does not create an attorney-client relationship between you and Vakil & Co. or any of its lawyers.\n\nAn attorney-client relationship is established only when:\n• You have signed a formal engagement letter or retainer agreement with Vakil & Co.\n• Vakil & Co. has confirmed in writing that it is representing you in a specific legal matter\n\nInformation shared before a formal engagement is not protected by attorney-client privilege.` },
  { title: "3. Not Legal Advice", content: `The information provided on this website, including articles, guides, FAQs, and service descriptions, is for general informational purposes only. It does not constitute legal advice and should not be relied upon as such.\n\nLegal outcomes depend on specific facts, applicable laws, and jurisdiction. Always consult a qualified lawyer before making any legal decisions. Vakil & Co. expressly disclaims liability for any action taken or not taken based on information on this website.` },
  { title: "4. Services", content: `Vakil & Co. provides legal consultancy, documentation, representation, and related services subject to the terms of individual engagement agreements. The scope, fees, timelines, and conditions of each service are governed by the specific engagement letter or service agreement entered into with each client.\n\nService availability may vary by state, jurisdiction, and applicable regulations. Vakil & Co. reserves the right to decline any engagement at its sole discretion.` },
  { title: "5. User Conduct", content: `When using our website and services, you agree not to:\n\n• Provide false, misleading, or fraudulent information\n• Impersonate any person or entity\n• Interfere with or disrupt the website or its servers\n• Attempt to gain unauthorised access to any part of the website\n• Use automated tools (bots, scrapers) to extract data without permission\n• Upload or transmit malicious code, viruses, or harmful content\n• Violate any applicable laws or regulations\n• Use the website for any unlawful or unauthorised purpose` },
  { title: "6. Intellectual Property", content: `All content on this website, including text, graphics, logos, icons, images, legal guides, and software, is the property of Vakil & Co. and is protected by Indian and international copyright, trademark, and other intellectual property laws.\n\nYou may view and print pages from this website for personal, non-commercial use. Any other use — including reproduction, modification, distribution, or commercial exploitation — requires prior written consent from Vakil & Co.` },
  { title: "7. Confidentiality and Data Protection", content: `We maintain strict confidentiality of all client information. Please review our Privacy Policy for detailed information on how we collect, use, and protect your personal data. Our Privacy Policy is incorporated into these Terms by reference.` },
  { title: "8. Fees and Payments", content: `Service fees are as agreed in individual engagement letters. Unless otherwise specified:\n\n• Retainer fees are due in advance before commencement of services\n• Invoices are payable within 15 days of issue\n• Late payments attract interest at 18% per annum\n• Disputed invoices must be raised within 7 days of receipt\n\nVakil & Co. reserves the right to suspend or terminate services for non-payment.` },
  { title: "9. Limitation of Liability", content: `To the maximum extent permitted by law, Vakil & Co., its partners, associates, and employees shall not be liable for:\n\n• Indirect, incidental, consequential, or punitive damages\n• Loss of profits, revenue, data, or business opportunities\n• Damages arising from reliance on information on this website\n• Service interruptions or technical failures\n\nOur total liability in connection with any engagement shall not exceed the fees paid by you for the specific service in question during the preceding 12 months.` },
  { title: "10. Dispute Resolution", content: `Any disputes arising out of or in connection with these Terms or our services shall be resolved as follows:\n\n• First, through good-faith negotiation between the parties\n• If unresolved within 30 days, through mediation under the Mediation and Conciliation Rules of the Bar Council of India\n• If still unresolved, through binding arbitration under the Arbitration and Conciliation Act, 1996, with a sole arbitrator mutually agreed upon\n\nThe seat of arbitration shall be Mumbai, Maharashtra. All proceedings shall be conducted in English.` },
  { title: "11. Governing Law", content: `These Terms are governed by the laws of India. Any legal proceedings not subject to arbitration shall be subject to the exclusive jurisdiction of the courts of Mumbai, Maharashtra.` },
  { title: "12. Modifications", content: `We reserve the right to modify these Terms at any time. Material changes will be notified by posting the updated Terms on this page with a revised effective date. Continued use of our services after such changes constitutes acceptance.` },
  { title: "13. Contact", content: `Questions about these Terms:\n\nVakil & Co. Legal Associates\nLevel 7, Capital Building, BKC, Bandra East, Mumbai – 400051\nEmail: legal@vakilco.in · Phone: 1800-123-4567` },
];

export default function TermsOfUse() {
  return (
    <>
      <Helmet>
        <title>Terms of Use — Vakil & Co.</title>
        <meta name="description" content="Vakil & Co. Terms of Use — please read before using our legal services website." />
      </Helmet>

      <section className="bg-[#0f2044] text-white py-16 px-4 text-center">
        <div className="container mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-[#c9a227]/20 text-[#c9a227] px-4 py-1.5 rounded-full text-sm font-medium mb-5"><FileText size={14} />Legal Documents</div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-3">Terms of Use</h1>
          <p className="text-white/60 text-sm">Last Updated: July 2026 · Please read these terms carefully before using our services.</p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-10 text-sm text-red-800">
            <strong>Important Notice:</strong> Use of this website does not create an attorney-client relationship. Information here is not legal advice. Please consult a qualified lawyer for specific legal matters.
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
