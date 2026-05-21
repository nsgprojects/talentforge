require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./index');

async function seed() {
  console.log('⟳  Seeding TalentForge v2...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Admin ──────────────────────────────────────────────
    const aHash = await bcrypt.hash('Admin@123', 12);
    const aRes = await client.query(`
      INSERT INTO users (name,email,phone,role,status,password_hash)
      VALUES ($1,$2,$3,'admin','active',$4)
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='admin'
      RETURNING id`,
      ['System Admin','admin@talentforge.com','+1-000-000-0000',aHash]
    );
    const adminId = aRes.rows[0].id;
    console.log('  ✓ Admin  →  admin@talentforge.com  /  Admin@123');

    // ── Recruiters ─────────────────────────────────────────
    const rHash = await bcrypt.hash('Recruiter@123', 12);
    const r1 = await client.query(`
      INSERT INTO users (name,email,phone,role,status,password_hash,created_by)
      VALUES ($1,$2,$3,'recruiter','active',$4,$5)
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='recruiter'
      RETURNING id`,
      ['Ravi Kumar','ravi@talentforge.com','+1-437-522-7577',rHash,adminId]
    );
    const r2 = await client.query(`
      INSERT INTO users (name,email,phone,role,status,password_hash,created_by)
      VALUES ($1,$2,$3,'recruiter','active',$4,$5)
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='recruiter'
      RETURNING id`,
      ['Priya Sharma','priya@talentforge.com','+1-647-888-9900',rHash,adminId]
    );
    console.log('  ✓ Recruiter 1  →  ravi@talentforge.com  /  Recruiter@123');
    console.log('  ✓ Recruiter 2  →  priya@talentforge.com  /  Recruiter@123');

    // ── Tech ecosystems ────────────────────────────────────
    const ecos = [
      ['DevOps','#7C3AED',1],['Cloud','#1D4ED8',2],['Java','#92400E',3],
      ['Security','#991B1B',4],['Observability','#065F46',5],['AI/ML','#6D28D9',6],
      ['Scripting','#374151',7],['Databases','#1F2937',8],
    ];
    for (const [name,color,order] of ecos) {
      await client.query(
        `INSERT INTO tech_ecosystems (name,color_hex,sort_order) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING`,
        [name,color,order]
      );
    }
    console.log('  ✓ Tech ecosystems seeded');

    // ── Sample base resume (V1 for Ravi) ──────────────────
    const ecoRow = await client.query(`SELECT id FROM tech_ecosystems WHERE name='DevOps'`);
    const ecoId = ecoRow.rows[0]?.id;
    await client.query(`
      INSERT INTO base_resumes
        (user_id,name,tech_stack,ecosystem_id,years_experience,version_number,
         summary_text,ats_score,content)
      VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8)
      ON CONFLICT DO NOTHING`,
      [
        r1.rows[0].id,
        'DevOps Engineer — 5yr',
        'DevOps',ecoId,5,
        'Versatile Cloud/DevOps Engineer with 5+ years in Kubernetes, CI/CD, and multi-cloud environments.',
        72,
        JSON.stringify({
          header:{ name:'Ravi Kumar', phone:'+1-437-522-7577', email:'ravi@talentforge.com' },
          skills:{ 'Cloud Platforms':'AWS, Azure, GCP', 'Containers':'Docker, Kubernetes, OpenShift', 'CI/CD':'Jenkins, GitLab, Azure DevOps' },
          experiences:[
            { company:'APPTOZA Inc', title:'SR DevOps Engineer', start:'2022-09', end:null, current:true,
              bullets:['Worked on multi-cloud environments with IAC on Azure and AWS.','Deployed Azure IaaS VMs into secure VNets.']},
            { company:'Micronet IT Solutions', title:'Cloud/DevOps Engineer', start:'2018-12', end:'2022-09', current:false,
              bullets:['Maintained AWS and architected legacy data migration to Redshift.','Worked on Kubernetes deployments using OpenShift.']},
          ],
          certifications:['AWS Certified Developer – Associate','Certified Kubernetes Administrator'],
          education:[
            { school:'University of Massachusetts', degree:"Master's, Finance and Business Analytics", start:'2016-01', end:'2017-12' }
          ],
        })
      ]
    );

    // ── Sample bullet points ───────────────────────────────
    const bullets = [
      { text:'Architected multi-region Kubernetes clusters on AWS EKS reducing deployment time by 60%.', eco:'DevOps', role:'SR DevOps Engineer', tags:['EKS','GitOps','Kubernetes'] },
      { text:'Implemented IaC with Terraform and Ansible across 500+ cloud resources on AWS and Azure.', eco:'DevOps', role:'Cloud Engineer', tags:['Terraform','Ansible','IaC'] },
      { text:'Led migration of 50+ microservices to Azure AKS, achieving 40% cost reduction.', eco:'Cloud', role:'Cloud Architect', tags:['Azure','AKS','Migration'] },
      { text:'Built centralized observability with Prometheus, Grafana and ELK, reducing MTTR from 4h to 22min.', eco:'Observability', role:'SRE Engineer', tags:['Prometheus','Grafana','ELK'] },
    ];
    for (const b of bullets) {
      const eRow = await client.query(`SELECT id FROM tech_ecosystems WHERE name=$1`, [b.eco]);
      if (eRow.rows[0]) {
        await client.query(`
          INSERT INTO bullet_points (content,stack_label,ecosystem_id,tags,source,created_by,experience_role)
          VALUES ($1,$2,$3,$4,'ai',$5,$6) ON CONFLICT DO NOTHING`,
          [b.text, b.eco, eRow.rows[0].id, b.tags, r1.rows[0].id, b.role]
        );
      }
    }
    console.log('  ✓ Sample resume and bullet points seeded');

    await client.query('COMMIT');
    console.log('\n✦ Seed complete!\n');
    console.log('  Admin     →  admin@talentforge.com   /  Admin@123');
    console.log('  Recruiter →  ravi@talentforge.com    /  Recruiter@123');
    console.log('  Recruiter →  priya@talentforge.com   /  Recruiter@123\n');
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
seed();

// (Seed also adds sample JDs after running — add this to the existing seed flow)
