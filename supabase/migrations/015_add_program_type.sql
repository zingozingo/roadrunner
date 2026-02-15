-- Migration 015: Add type column to programs table
-- Categorizes programs into: Competency, Service Ready, SCA, Program, Credit Program

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS type text
  CHECK (type IS NULL OR type IN ('Competency', 'Service Ready', 'SCA', 'Program', 'Credit Program'));

-- Populate type for all existing programs

UPDATE programs SET type = 'Competency' WHERE name IN (
  'Security Competency',
  'DevOps Competency',
  'SMB Software Competency',
  'Data & Analytics Competency',
  'Cloud Operations Competency',
  'Built-In Competency',
  'Observability Competency',
  'Financial Services Competency',
  'Generative AI Competency',
  'Digital Workspace Competency',
  'Healthcare Competency',
  'Nonprofit ISV Competency',
  'Media & Entertainment Competency',
  'Manufacturing & Industrial Competency',
  'Government Competency',
  'Migration & Modernization Competency'
);

UPDATE programs SET type = 'Service Ready' WHERE name IN (
  'Lambda Service Ready',
  'WAF Service Ready',
  'Graviton Service Ready',
  'Amazon RDS Service Ready',
  'Linux Service Ready',
  'PrivateLink Service Ready'
);

UPDATE programs SET type = 'SCA' WHERE name IN (
  'GenAI SCA',
  'PE SCA',
  'GTM SCA'
);

UPDATE programs SET type = 'Program' WHERE name IN (
  'Wholesale Marketplace Program (WMP)',
  'DSOR',
  'Passport Program',
  'Marketplace Seller Prime',
  'Direct Deal Exception Pathway',
  'Well-Architected Partner Program'
);

UPDATE programs SET type = 'Credit Program' WHERE name IN (
  'MPOPP Activate',
  'MPOPP Grow'
);

-- Populate eligibility for all 33 programs

UPDATE programs SET eligibility = 'Validated customer references, technical review, AWS-hosted or deeply integrated solution, annual renewal audit' WHERE name = 'Security Competency';
UPDATE programs SET eligibility = 'Validated customer references, technical review, demonstrated DevOps workflow integration with AWS services, annual renewal' WHERE name = 'DevOps Competency';
UPDATE programs SET eligibility = 'Validated SMB customer references, technical review, demonstrated SMB-appropriate deployment model, annual renewal' WHERE name = 'SMB Software Competency';
UPDATE programs SET eligibility = 'Validated customer references, technical review, demonstrated integration with AWS analytics services, annual renewal' WHERE name = 'Data & Analytics Competency';
UPDATE programs SET eligibility = 'Validated customer references, technical review, demonstrated cloud operations capabilities, annual renewal' WHERE name = 'Cloud Operations Competency';
UPDATE programs SET eligibility = 'Validated customer references, technical deep-dive showing native AWS service integration, annual renewal' WHERE name = 'Built-In Competency';
UPDATE programs SET eligibility = 'Validated customer references, technical review, demonstrated integration with AWS observability services (CloudWatch, X-Ray, OpenSearch), annual renewal' WHERE name = 'Observability Competency';
UPDATE programs SET eligibility = 'Validated FinServ customer references, technical review, demonstrated compliance capabilities (SOC2, PCI-DSS, etc.), annual renewal' WHERE name = 'Financial Services Competency';
UPDATE programs SET eligibility = 'Validated customer references with GenAI use cases, technical review showing AWS AI/ML service integration, annual renewal' WHERE name = 'Generative AI Competency';
UPDATE programs SET eligibility = 'Validated customer references, technical review, demonstrated integration with AWS workspace services, annual renewal' WHERE name = 'Digital Workspace Competency';
UPDATE programs SET eligibility = 'Validated healthcare customer references, technical review, demonstrated HIPAA compliance, annual renewal' WHERE name = 'Healthcare Competency';
UPDATE programs SET eligibility = 'Validated nonprofit customer references, technical review, demonstrated nonprofit-specific functionality, annual renewal' WHERE name = 'Nonprofit ISV Competency';
UPDATE programs SET eligibility = 'Validated M&E customer references, technical review, demonstrated media workflow integration with AWS, annual renewal' WHERE name = 'Media & Entertainment Competency';
UPDATE programs SET eligibility = 'Validated manufacturing/industrial customer references, technical review, demonstrated OT/IoT integration with AWS, annual renewal' WHERE name = 'Manufacturing & Industrial Competency';
UPDATE programs SET eligibility = 'Validated government customer references, technical review, demonstrated compliance capabilities (FedRAMP, ITAR, etc.), annual renewal' WHERE name = 'Government Competency';
UPDATE programs SET eligibility = 'Validated migration/modernization customer references, technical review, demonstrated use of AWS migration tools (MGN, DMS, etc.), annual renewal' WHERE name = 'Migration & Modernization Competency';

UPDATE programs SET eligibility = 'Technical validation by AWS service team, demonstrated Lambda integration in production workloads' WHERE name = 'Lambda Service Ready';
UPDATE programs SET eligibility = 'Technical validation by AWS service team, demonstrated WAF integration and rule management' WHERE name = 'WAF Service Ready';
UPDATE programs SET eligibility = 'Technical validation by AWS service team, demonstrated Graviton compatibility and performance benchmarks' WHERE name = 'Graviton Service Ready';
UPDATE programs SET eligibility = 'Technical validation by AWS service team, demonstrated RDS integration in production workloads' WHERE name = 'Amazon RDS Service Ready';
UPDATE programs SET eligibility = 'Technical validation by AWS service team, demonstrated Linux deployment and compatibility' WHERE name = 'Linux Service Ready';
UPDATE programs SET eligibility = 'Technical validation by AWS service team, demonstrated PrivateLink endpoint implementation' WHERE name = 'PrivateLink Service Ready';

UPDATE programs SET eligibility = 'AWS sponsor (typically GTM or product team), negotiated terms, partner commitment to Bedrock/SageMaker integration or GenAI solution development' WHERE name = 'GenAI SCA';
UPDATE programs SET eligibility = 'AWS sponsor, negotiated terms, partner commitment to enablement milestones' WHERE name = 'PE SCA';
UPDATE programs SET eligibility = 'AWS sponsor, negotiated terms, partner commitment to co-sell targets and GTM milestones' WHERE name = 'GTM SCA';

UPDATE programs SET eligibility = 'Active Marketplace listing, channel partner relationships, Marketplace operations maturity' WHERE name = 'Wholesale Marketplace Program (WMP)';
UPDATE programs SET eligibility = 'Distributor relationship established, operational readiness for resale workflow' WHERE name = 'DSOR';
UPDATE programs SET eligibility = 'PDM nomination, partner commitment to attend workshops and complete exercises' WHERE name = 'Passport Program';
UPDATE programs SET eligibility = 'Marketplace sales performance thresholds, operational maturity, active co-sell participation' WHERE name = 'Marketplace Seller Prime';
UPDATE programs SET eligibility = 'Approval from AWS, demonstrated need for exception pathway, monthly compliance audits' WHERE name = 'Direct Deal Exception Pathway';
UPDATE programs SET eligibility = 'Certified Well-Architected practitioners, demonstrated review capabilities, AWS approval' WHERE name = 'Well-Architected Partner Program';

UPDATE programs SET eligibility = 'Active Marketplace listing, limited existing Marketplace revenue, PDM sponsorship' WHERE name = 'MPOPP Activate';
UPDATE programs SET eligibility = 'Demonstrated Marketplace revenue history, active co-sell participation, PDM sponsorship' WHERE name = 'MPOPP Grow';
