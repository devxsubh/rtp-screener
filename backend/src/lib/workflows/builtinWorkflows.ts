export type BuiltinWorkflow = {
  id: string;
  title: string;
  type: "assistant" | "tabular";
  practice: string | null;
  prompt_md: string | null;
  columns_config: Record<string, unknown>[] | null;
};

export const BUILTIN_WORKFLOWS: BuiltinWorkflow[] = [
  {
    id: "builtin-cp-checklist",
    title: "Generate CP Checklist",
    type: "assistant",
    practice: "General Transactions",
    prompt_md:
      "## Generate Conditions Precedent Checklist\n\n" +
      "Review the uploaded credit agreement or financing document and generate a comprehensive " +
      "Conditions Precedent (CP) checklist.\n\n" +
      "Structure the document as follows:\n" +
      "- For each category of conditions (e.g. Corporate, Financial, Legal, Security), add a section with a heading\n" +
      "- Under each category heading, include a table with exactly these four columns in this order:\n" +
      "  1. Index — sequential number within the category (1, 2, 3…)\n" +
      "  2. Clause Number — the clause or schedule reference from the agreement\n" +
      "  3. Clause — a concise description of the condition precedent\n" +
      "  4. Status — leave blank (empty string) for the user to fill in",
    columns_config: null,
  },
  {
    id: "builtin-coc-dd",
    title: "Change of Control Review",
    type: "tabular",
    practice: "Corporate",
    prompt_md:
      "## Change of Control Due Diligence Review\n\n" +
      "This workflow performs a change of control due diligence review across the selected documents.",
    columns_config: [
      { index: 0, name: "Parties", format: "bulleted_list", prompt: "Identify all parties to this agreement. For each party state their full legal name and their role (e.g. counterparty, licensor, lender, supplier)." },
      { index: 1, name: "Date", format: "date", prompt: "What is the date of this agreement? If a commencement date differs from the signing date, state both." },
      { index: 2, name: "Term", format: "text", prompt: "What is the term or duration of this agreement? State the start and end dates or the length of the term." },
      { index: 3, name: "Change of Control Clause", prompt: "Identify and summarize the change of control clause(s) in this document. Quote the exact triggering language and specify what constitutes a 'change of control'." },
      { index: 4, name: "Consent Required", prompt: "Does a change of control require prior consent from any party? Identify who must consent, the notice period, and any conditions." },
      { index: 5, name: "Termination Rights", prompt: "What termination rights arise upon a change of control? Who can terminate, and what are the notice requirements?" },
      { index: 6, name: "Put/Call Options", prompt: "Are there any put or call options triggered by a change of control? Summarize the terms, pricing, and exercise period." },
      { index: 7, name: "Financial Implications", prompt: "What are the financial implications of a change of control? Include any fees, payments, accelerated obligations, or pricing adjustments." },
    ],
  },
  {
    id: "builtin-credit-summary",
    title: "Credit Agreement Summary",
    type: "assistant",
    practice: "Finance",
    prompt_md:
      "## Credit Agreement Summary\n\n" +
      "Review the uploaded credit agreement and produce a comprehensive legal summary covering lenders, " +
      "borrowers, facilities, covenants, security, events of default, and governing law. " +
      "Quote clause references and flag unusual or non-market terms.",
    columns_config: null,
  },
  {
    id: "builtin-commercial-agreement",
    title: "Commercial Agreement Review",
    type: "tabular",
    practice: "General Transactions",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Parties", format: "bulleted_list", prompt: "Identify all parties to this agreement. For each party state their full legal name, jurisdiction of incorporation (if stated), and their role in the agreement." },
      { index: 1, name: "Scope of Work", format: "text", prompt: "Summarise the scope of work or services to be provided under this agreement." },
      { index: 2, name: "Amends Earlier Agreement", format: "yes_no", prompt: "Does this agreement amend, restate, supplement, or replace an earlier agreement?" },
      { index: 3, name: "Effective Date", format: "date", prompt: "What is the effective date or commencement date of this agreement?" },
      { index: 4, name: "Term", format: "text", prompt: "What is the duration or term of this agreement?" },
      { index: 5, name: "Renewal", format: "text", prompt: "What renewal provisions apply?" },
      { index: 6, name: "Pricing", format: "text", prompt: "What is the pricing structure under this agreement?" },
      { index: 7, name: "Price Adjustments", format: "text", prompt: "Are there any price adjustment mechanisms in this agreement?" },
      { index: 8, name: "Penalties for Late Payment", format: "text", prompt: "What penalties or consequences apply for late payment?" },
      { index: 9, name: "Estimated Contract Value", format: "monetary_amount", prompt: "What is the total estimated or stated contract value?" },
      { index: 10, name: "Limitation of Liability", format: "text", prompt: "What limitations of liability apply?" },
      { index: 11, name: "IP Ownership and Licensing", format: "text", prompt: "How is intellectual property ownership and licensing addressed?" },
      { index: 12, name: "Change of Control", format: "text", prompt: "Is there a change of control provision?" },
      { index: 13, name: "Force Majeure", format: "text", prompt: "Summarise the force majeure clause." },
      { index: 14, name: "Termination Rights", format: "text", prompt: "What are the termination rights of each party?" },
      { index: 15, name: "Liquidated Damages", format: "text", prompt: "Are there any liquidated damages provisions?" },
      { index: 16, name: "Governing Law", format: "text", prompt: "What governing law applies to this agreement?" },
      { index: 17, name: "Dispute Resolution", format: "text", prompt: "How are disputes resolved under this agreement?" },
    ],
  },
  {
    id: "builtin-credit-agreement",
    title: "Credit Agreement Review",
    type: "tabular",
    practice: "Finance",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Lenders", format: "bulleted_list", prompt: "Identify all lenders named in this agreement." },
      { index: 1, name: "Borrowers", format: "bulleted_list", prompt: "Identify all borrowers named in this agreement." },
      { index: 2, name: "Guarantors", format: "bulleted_list", prompt: "Identify all guarantors named in this agreement." },
      { index: 3, name: "Other Parties", format: "bulleted_list", prompt: "Identify any other material parties to this agreement." },
      { index: 4, name: "Date of Agreement", format: "date", prompt: "What is the date of this credit agreement?" },
      { index: 5, name: "Facility", format: "bulleted_list", prompt: "List each facility available under this agreement." },
      { index: 6, name: "Amount", format: "monetary_amount", prompt: "What is the total committed amount available under this agreement?" },
      { index: 7, name: "Purpose", format: "text", prompt: "What is the stated purpose for which borrowings may be used?" },
      { index: 8, name: "Interest", format: "text", prompt: "What interest rate applies to borrowings under this agreement?" },
      { index: 9, name: "Commitment Fee", format: "text", prompt: "Is there a commitment fee or utilisation fee?" },
      { index: 10, name: "Repayment Schedule", format: "text", prompt: "Summarise the repayment schedule for each facility." },
      { index: 11, name: "Maturity", format: "date", prompt: "What is the final maturity date of the facilities?" },
      { index: 12, name: "Security", format: "bulleted_list", prompt: "What security is granted or required under this agreement?" },
      { index: 13, name: "Guarantees", format: "bulleted_list", prompt: "What guarantee obligations are given under this agreement?" },
      { index: 14, name: "Financial Covenants", format: "bulleted_list", prompt: "What financial covenants are included in this agreement?" },
      { index: 15, name: "Events of Default", format: "bulleted_list", prompt: "List the events of default under this agreement." },
      { index: 16, name: "Assignment", format: "text", prompt: "What restrictions or permissions apply to assignment or transfer?" },
      { index: 17, name: "Change of Control", format: "text", prompt: "Is there a change of control provision?" },
      { index: 18, name: "Prepayment Fee", format: "text", prompt: "Are there any prepayment fees, make-whole premiums, or soft-call protections?" },
      { index: 19, name: "Governing Law", format: "text", prompt: "What governing law applies to this agreement?" },
      { index: 20, name: "Dispute Resolution", format: "text", prompt: "How are disputes resolved under this agreement?" },
    ],
  },
  {
    id: "builtin-ediscovery",
    title: "E-Discovery Review",
    type: "tabular",
    practice: "Litigation",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Date", format: "date", prompt: "What is the date of this document?" },
      { index: 1, name: "Type of Document", format: "text", prompt: "What type of document is this?" },
      { index: 2, name: "Sender", format: "text", prompt: "Who is the sender or author of this document?" },
      { index: 3, name: "Recipient(s)", format: "bulleted_list", prompt: "Who are the recipients of this document?" },
      { index: 4, name: "Summary", format: "text", prompt: "Provide a concise factual summary of the content of this document in 2–4 sentences." },
      { index: 5, name: "Persons Mentioned", format: "bulleted_list", prompt: "List all individuals mentioned in this document (other than the sender and recipients)." },
      { index: 6, name: "Privileged?", format: "yes_no", prompt: "Does this document appear to be legally privileged?" },
    ],
  },
  {
    id: "builtin-supply-agreement",
    title: "Supply Agreement Review",
    type: "tabular",
    practice: "General Transactions",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Parties", format: "bulleted_list", prompt: "Identify all parties to this supply agreement." },
      { index: 1, name: "Effective Date", format: "date", prompt: "What is the effective date or commencement date of this agreement?" },
      { index: 2, name: "Products", format: "bulleted_list", prompt: "What products are to be supplied under this agreement?" },
      { index: 3, name: "Term", format: "text", prompt: "What is the initial term or duration of this agreement?" },
      { index: 4, name: "Renewal", format: "text", prompt: "What renewal provisions apply?" },
      { index: 5, name: "Delivery", format: "text", prompt: "What delivery obligations and terms apply?" },
      { index: 6, name: "Quality", format: "text", prompt: "What quality standards or specifications apply to the products?" },
      { index: 7, name: "Warranties", format: "text", prompt: "What warranties does the supplier give in relation to the products?" },
      { index: 8, name: "Liquidated Damages", format: "text", prompt: "Are there any liquidated damages provisions?" },
      { index: 9, name: "Limitation of Liability", format: "text", prompt: "What limitations of liability apply?" },
      { index: 10, name: "Force Majeure", format: "text", prompt: "Summarise the force majeure clause." },
      { index: 11, name: "Termination Rights", format: "text", prompt: "What are the termination rights of each party?" },
      { index: 12, name: "Governing Law", format: "text", prompt: "What governing law applies to this agreement?" },
      { index: 13, name: "Dispute Resolution", format: "text", prompt: "How are disputes resolved under this agreement?" },
    ],
  },
  {
    id: "builtin-spa",
    title: "SPA Review",
    type: "tabular",
    practice: "Corporate",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Parties", format: "bulleted_list", prompt: "Identify all parties to this share purchase agreement." },
      { index: 1, name: "Date", format: "date", prompt: "What is the date of this share purchase agreement?" },
      { index: 2, name: "Transaction", format: "text", prompt: "Summarise the transaction." },
      { index: 3, name: "Consideration", format: "monetary_amount", prompt: "What is the consideration payable under this agreement?" },
      { index: 4, name: "Key Conditions Precedent", format: "bulleted_list", prompt: "List the key conditions precedent (CPs) to completion." },
      { index: 5, name: "Completion Date", format: "text", prompt: "When does completion occur?" },
      { index: 6, name: "Warranties", format: "text", prompt: "Summarise the warranty package." },
      { index: 7, name: "Indemnities", format: "text", prompt: "Are there specific indemnities in this agreement?" },
      { index: 8, name: "Limitation of Liability", format: "text", prompt: "What limitations on liability apply to warranty and indemnity claims?" },
      { index: 9, name: "Covenants", format: "text", prompt: "What restrictive or other covenants are given by the seller or management?" },
      { index: 10, name: "Exclusivity", format: "text", prompt: "Is there an exclusivity or no-shop provision in this agreement?" },
      { index: 11, name: "Governing Law and Jurisdiction", format: "text", prompt: "What governing law applies to this agreement?" },
      { index: 12, name: "Dispute Resolution", format: "text", prompt: "How are disputes to be resolved under this agreement?" },
    ],
  },
  {
    id: "builtin-nda",
    title: "NDA Review",
    type: "tabular",
    practice: "General Transactions",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Direction", format: "tag", prompt: "Is this NDA mutual or unilateral?" },
      { index: 1, name: "Definition of Confidential Information", format: "text", prompt: "How is 'Confidential Information' defined in this agreement?" },
      { index: 2, name: "Obligations of Receiving Party", format: "bulleted_list", prompt: "What are the key obligations of the receiving party in respect of the confidential information?" },
      { index: 3, name: "Standard Carveouts Present?", format: "yes_no", prompt: "Does the agreement include the standard carveouts to confidentiality obligations?" },
      { index: 4, name: "Permitted Disclosures", format: "bulleted_list", prompt: "To whom may the receiving party disclose confidential information?" },
      { index: 5, name: "Term and Duration", format: "text", prompt: "What is the term of this NDA and how long do the confidentiality obligations last?" },
      { index: 6, name: "Return and Destruction", format: "text", prompt: "What obligations apply on expiry or termination regarding return or destruction of confidential information?" },
      { index: 7, name: "Remedies", format: "text", prompt: "What remedies are available for breach of the confidentiality obligations?" },
      { index: 8, name: "Governing Law and Jurisdiction", format: "text", prompt: "What governing law applies to this agreement?" },
    ],
  },
  {
    id: "builtin-commercial-lease",
    title: "Commercial Lease Review",
    type: "tabular",
    practice: "Real Estate",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Landlord", format: "text", prompt: "Who is the landlord under this lease?" },
      { index: 1, name: "Tenant", format: "text", prompt: "Who is the tenant under this lease?" },
      { index: 2, name: "Guarantor", format: "text", prompt: "Is there a guarantor under this lease?" },
      { index: 3, name: "Premises", format: "text", prompt: "Describe the premises demised under this lease." },
      { index: 4, name: "Date of Lease", format: "date", prompt: "What is the date of this lease?" },
      { index: 5, name: "Term", format: "text", prompt: "What is the contractual term of this lease?" },
      { index: 6, name: "Rent", format: "monetary_amount", prompt: "What is the initial annual rent payable under this lease?" },
      { index: 7, name: "Rent Review", format: "text", prompt: "Are there rent review provisions?" },
      { index: 8, name: "Service Charge", format: "text", prompt: "Is the tenant liable for a service charge?" },
      { index: 9, name: "Insurance", format: "text", prompt: "What are the insurance obligations under this lease?" },
      { index: 10, name: "Permitted Use", format: "text", prompt: "What is the permitted use of the premises under this lease?" },
      { index: 11, name: "Repair & Maintenance", format: "text", prompt: "Who is responsible for repair and maintenance of the premises?" },
      { index: 12, name: "Alterations", format: "text", prompt: "What alterations may the tenant make to the premises?" },
      { index: 13, name: "Assignment & Subletting", format: "text", prompt: "What rights does the tenant have to assign or sublet the premises?" },
      { index: 14, name: "Break Rights", format: "text", prompt: "Are there any break rights in this lease?" },
      { index: 15, name: "Security of Tenure", format: "yes_no", prompt: "Does the tenant have statutory security of tenure?" },
      { index: 16, name: "Dilapidations", format: "text", prompt: "What dilapidations obligations apply at the end of the term?" },
      { index: 17, name: "Rent Deposit", format: "monetary_amount", prompt: "Is a rent deposit required?" },
      { index: 18, name: "Forfeiture & Termination", format: "text", prompt: "What are the landlord's forfeiture or termination rights?" },
      { index: 19, name: "Governing Law", format: "text", prompt: "What governing law applies to this lease?" },
    ],
  },
  {
    id: "builtin-lpa",
    title: "Limited Partnership Agreement Review",
    type: "tabular",
    practice: "Private Equity",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "General Partner", format: "text", prompt: "Identify the General Partner(s) of the fund." },
      { index: 1, name: "Fund Name & Jurisdiction", format: "text", prompt: "What is the full name of the fund and in which jurisdiction is the limited partnership established?" },
      { index: 2, name: "Total Committed Capital", format: "monetary_amount", prompt: "What is the total committed capital of the fund?" },
      { index: 3, name: "Capital Calls & Drawdowns", format: "text", prompt: "How and when may the GP call capital from LPs?" },
      { index: 4, name: "Penalties for Failure to Fund", format: "text", prompt: "What are the consequences if an LP fails to fund a capital call?" },
      { index: 5, name: "Investment Scope & Restrictions", format: "text", prompt: "What is the fund's stated investment strategy, scope, and any restrictions?" },
      { index: 6, name: "Fund Term", format: "text", prompt: "What is the term of the fund?" },
      { index: 7, name: "Management Fee", format: "text", prompt: "What management fee is payable to the GP or manager?" },
      { index: 8, name: "Carried Interest", format: "text", prompt: "What carried interest (carry) is payable to the GP?" },
      { index: 9, name: "Preferred Return (Hurdle Rate)", format: "percentage", prompt: "Is there a preferred return or hurdle rate?" },
      { index: 10, name: "GP Catch-Up", format: "text", prompt: "Is there a GP catch-up mechanism after the preferred return is met?" },
      { index: 11, name: "Clawback", format: "text", prompt: "Is there a clawback obligation on the GP if it receives excess carry?" },
      { index: 12, name: "Fees & Expenses (Beyond Management Fee)", format: "bulleted_list", prompt: "What fees and expenses are charged to the fund or LPs beyond the management fee?" },
      { index: 13, name: "Distributions", format: "text", prompt: "How and when are distributions made to LPs?" },
      { index: 14, name: "Key Person Clause", format: "text", prompt: "Is there a key person clause?" },
      { index: 15, name: "Removal of the GP", format: "text", prompt: "Under what circumstances can the GP be removed?" },
      { index: 16, name: "Advisory Committee (LPAC)", format: "text", prompt: "Is there an LP Advisory Committee (LPAC) or similar governance body?" },
      { index: 17, name: "Transfer Restrictions", format: "text", prompt: "What restrictions apply to an LP transferring or assigning its interest in the fund?" },
      { index: 18, name: "Conflicts of Interest", format: "text", prompt: "How does the agreement address conflicts of interest?" },
      { index: 19, name: "Governing Law", format: "text", prompt: "What governing law applies to this agreement?" },
    ],
  },
  {
    id: "builtin-sha-summary",
    title: "Shareholder Agreement Summary",
    type: "assistant",
    practice: "Corporate",
    prompt_md:
      "## Shareholder Agreement Summary\n\n" +
      "Review the uploaded shareholder agreement and produce a comprehensive legal summary covering parties, " +
      "share classes, board composition, reserved matters, transfer restrictions, drag/tag rights, " +
      "anti-dilution, and exit mechanics.",
    columns_config: null,
  },
  {
    id: "builtin-cap-table-screen",
    title: "Cap Table Sanctions Screen",
    type: "assistant",
    practice: "Compliance",
    prompt_md:
      "## Cap Table Sanctions Screen\n\n" +
      "When the user provides a cap-table CSV, call screen_cap_table immediately to run Watchman sanctions screening.\n\n" +
      "Then:\n" +
      "1. Summarize total entities screened and counts by risk level (flagged / review / clear) in 2–4 sentences.\n" +
      "2. Do NOT list individual entities or match details in chat — the side panel shows the ownership graph and entity risk table.\n" +
      "3. Use query_screening_data with entity_detail when the user asks about a specific entity — never invent match scores.\n" +
      "4. Recommend human expert verification for final decisions.\n\n" +
      "Never conclude guilt or confirm sanctions violations.",
    columns_config: null,
  },
  {
    id: "builtin-ic-memo",
    title: "IC Compliance Memo",
    type: "assistant",
    practice: "Compliance",
    prompt_md:
      "## Investment Committee Compliance Memo\n\n" +
      "Draft a concise IC memo from screening results in this session.\n\n" +
      "Include:\n" +
      "- Executive summary (1 paragraph)\n" +
      "- Screening scope and methodology\n" +
      "- Flagged and review entities with match scores and ownership chains\n" +
      "- Recommended next steps for the compliance team\n" +
      "- Open questions / items requiring human review\n\n" +
      "Call generate_ic_memo to save the memo as a startup document (do not paste the full memo in chat). Use get_screening_summary and get_entity_details for facts. Decision support only — not a legal determination.",
    columns_config: null,
  },
  {
    id: "builtin-cap-table-review",
    title: "Cap Table Sanctions Review",
    type: "tabular",
    practice: "Compliance",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Entity", format: "text", prompt: "State the full name of this entity exactly as it appears in the cap table." },
      { index: 1, name: "Type", format: "text", prompt: "Is this entity a person or a company?" },
      { index: 2, name: "Ultimate Owner?", format: "yes_no", prompt: "Is this entity the ultimate beneficial owner?" },
      { index: 3, name: "Ownership Path", format: "text", prompt: "Describe the full ownership chain from this entity up to the portfolio company." },
      { index: 4, name: "Indirect %", format: "text", prompt: "What is the effective indirect ownership stake in the portfolio company (%)?" },
      { index: 5, name: "Sanctions Match", format: "text", prompt: "What is the closest match found on the OFAC SDN or UN consolidated sanctions list for this entity?" },
      { index: 6, name: "Match Score", format: "text", prompt: "What is the match confidence score (0–100%) for the closest sanctions list match?" },
      { index: 7, name: "Source List", format: "text", prompt: "Which sanctions list produced the highest-scoring match?" },
      { index: 8, name: "Risk", format: "tag", prompt: "Based on the match score, what is the risk classification for this entity?" },
      { index: 9, name: "Status", format: "text", prompt: "Leave this column blank — it is for the compliance officer to complete after human review." },
    ],
  },
  {
    id: "builtin-shareholder-agreement",
    title: "Shareholder Agreement Review",
    type: "tabular",
    practice: "Corporate",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Parties", format: "bulleted_list", prompt: "Identify all parties to this shareholder agreement." },
      { index: 1, name: "Date", format: "date", prompt: "What is the date of this shareholder agreement?" },
      { index: 2, name: "Share Capital & Classes", format: "bulleted_list", prompt: "What classes of shares are in issue or contemplated by this agreement?" },
      { index: 3, name: "Shareholdings", format: "bulleted_list", prompt: "What are the shareholdings of each party?" },
      { index: 4, name: "Board Composition", format: "text", prompt: "How is the board of directors constituted under this agreement?" },
      { index: 5, name: "Reserved Matters", format: "bulleted_list", prompt: "What are the reserved matters or veto rights set out in this agreement?" },
      { index: 6, name: "Pre-emption on New Shares", format: "text", prompt: "What pre-emption rights apply on the issuance of new shares?" },
      { index: 7, name: "Transfer Restrictions", format: "text", prompt: "What restrictions apply to the transfer of shares?" },
      { index: 8, name: "Right of First Refusal / Pre-emption on Transfer", format: "text", prompt: "Is there a right of first refusal or pre-emption right on a proposed transfer of shares?" },
      { index: 9, name: "Drag-Along Rights", format: "text", prompt: "Are there drag-along rights?" },
      { index: 10, name: "Tag-Along Rights", format: "text", prompt: "Are there tag-along rights?" },
      { index: 11, name: "Anti-Dilution Protections", format: "text", prompt: "Are there any anti-dilution protections for any class of shareholders?" },
      { index: 12, name: "Dividend Policy", format: "text", prompt: "What dividend provisions are set out in this agreement?" },
      { index: 13, name: "Exit & Liquidity Provisions", format: "text", prompt: "What exit or liquidity provisions are included?" },
      { index: 14, name: "Deadlock", format: "text", prompt: "How is deadlock addressed?" },
      { index: 15, name: "Non-Compete & Non-Solicitation", format: "text", prompt: "Are any shareholders subject to non-compete or non-solicitation obligations?" },
      { index: 16, name: "Confidentiality", format: "text", prompt: "What confidentiality obligations are imposed on the shareholders?" },
      { index: 17, name: "Warranties", format: "text", prompt: "What warranties are given by the shareholders under this agreement?" },
      { index: 18, name: "Governing Law", format: "text", prompt: "What governing law applies to this agreement?" },
      { index: 19, name: "Dispute Resolution", format: "text", prompt: "How are disputes resolved under this agreement?" },
    ],
  },
  {
    id: "builtin-employment-agreement",
    title: "Employment Agreement Review",
    type: "tabular",
    practice: "Employment",
    prompt_md: null,
    columns_config: [
      { index: 0, name: "Employer", format: "text", prompt: "Who is the employer under this agreement?" },
      { index: 1, name: "Employee", format: "text", prompt: "Who is the employee under this agreement?" },
      { index: 2, name: "Date", format: "date", prompt: "What is the date of this employment agreement?" },
      { index: 3, name: "Title", format: "text", prompt: "What is the employee's job title or position?" },
      { index: 4, name: "Compensation", format: "text", prompt: "What is the employee's compensation under this agreement?" },
      { index: 5, name: "Full Time / Part Time", format: "tag", prompt: "Is this a full-time or part-time position?" },
      { index: 6, name: "Independent Contractor?", format: "yes_no", prompt: "Does the agreement characterise the worker as an independent contractor?" },
      { index: 7, name: "Benefits", format: "bulleted_list", prompt: "What benefits are the employee entitled to under this agreement?" },
      { index: 8, name: "Notice Period (Employer to Employee)", format: "text", prompt: "What notice must the employer give to terminate the employee's employment?" },
      { index: 9, name: "Notice Period (Employee to Employer)", format: "text", prompt: "What notice must the employee give to resign?" },
      { index: 10, name: "Overtime", format: "text", prompt: "What provisions apply to overtime?" },
      { index: 11, name: "Working Hours", format: "text", prompt: "What working hours are specified in this agreement?" },
      { index: 12, name: "Variation", format: "text", prompt: "What provisions govern variation of the terms of this agreement?" },
      { index: 13, name: "Intellectual Property Assignment", format: "text", prompt: "What intellectual property assignment provisions are included?" },
      { index: 14, name: "Grounds for Termination", format: "bulleted_list", prompt: "What grounds for summary dismissal or termination for cause are set out in the agreement?" },
      { index: 15, name: "Annual Leave Entitlement", format: "text", prompt: "What is the employee's annual leave entitlement?" },
    ],
  },
];
