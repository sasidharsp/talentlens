/**
 * About.jsx — I&O Enterprise Production Engineering Assessment
 * Background, purpose and intention behind TalentLens
 */

const CLUSTERS = [
  { cluster:'Linux Kernel & OS Internals',        qs:60,  focus:'CPU scheduling, NUMA, memory pressure, I/O wait, kernel debugging' },
  { cluster:'Middleware & JVM Engineering',        qs:70,  focus:'GC, heap/thread analysis, connection pooling, clustered failures' },
  { cluster:'Wealth-Tech Production Scenarios',   qs:40,  focus:'Advisor platforms, transaction integrity, session consistency' },
  { cluster:'Enterprise Networking',              qs:50,  focus:'TCP internals, asymmetric routing, SSL/TLS, LB behavior' },
  { cluster:'Storage & Database Infrastructure',  qs:50,  focus:'SAN latency, replication, backup contention, IOPS diagnostics' },
  { cluster:'Cloud, Containers & Kubernetes',     qs:50,  focus:'Hybrid cloud ops, Kubernetes failures, autoscaling' },
  { cluster:'Incident Command & RCA',             qs:40,  focus:'Sev-1 leadership, blast radius, dependency mapping' },
  { cluster:'SRE / Observability Engineering',    qs:40,  focus:'SLIs/SLOs, tracing, telemetry, synthetic monitoring' },
  { cluster:'Security Engineering',              qs:35,  focus:'PAM, zero trust, certificate failures, secrets handling' },
  { cluster:'Automation & IaC',                  qs:30,  focus:'Terraform drift, Ansible orchestration, CI/CD failures' },
  { cluster:'Windows Enterprise Infrastructure', qs:20,  focus:'AD replication, Kerberos, GPO failures' },
  { cluster:'Messaging & Distributed Systems',   qs:15,  focus:'Kafka, MQ, transaction sequencing' },
];

const ASSESSMENT_AREAS = [
  { title:'Deep Troubleshooting',         desc:'Isolate failure domains across infra/app/network/storage layers' },
  { title:'Production Incident Reasoning',desc:'Handle high-severity incidents under regulatory pressure' },
  { title:'Architecture Understanding',   desc:'HA/DR design, hybrid cloud, distributed middleware estates' },
  { title:'Performance Tuning',           desc:'OS internals, JVM diagnostics, kernel/resource bottlenecks' },
  { title:'Root-Cause Thinking',          desc:'Avoid false positives; map blast radius; lead outage bridges' },
  { title:'Resiliency Engineering',       desc:'Recovery strategy, automation, SRE observability' },
];

const SCENARIOS = [
  { title:'Trading Batch Delays',                 desc:'Identifying bottlenecks causing overnight batch jobs to miss windows' },
  { title:'Market Open Surge Events',             desc:'Handling infrastructure spikes at peak market-open time' },
  { title:'Advisor Portal Latency',               desc:'Diagnosing slow advisor-facing UI under load — storage, app, or network?' },
  { title:'End-of-Day Reconciliation Failures',   desc:'Tracing transaction integrity issues in reconciliation pipelines' },
  { title:'Wealth Reporting Degradation',         desc:'Root-causing reporting platform slowdowns for advisors and clients' },
  { title:'Regulatory Reporting Impact',          desc:'Ensuring compliance delivery is unaffected during incidents' },
  { title:'Certificate Expiry During Trading Hours',desc:'Emergency TLS rotation without disrupting live trading systems' },
  { title:'Advisor Onboarding Resiliency',        desc:'Maintaining availability of onboarding flows during outages' },
];

const SAMPLE_QUESTIONS = [
  {
    category:'Wealth-Tech / F5 / Session',
    scenario:`An advisor portal behind F5 load balancers shows:\n• Successful authentication\n• Random portfolio-view failures after login\n• Backend nodes healthy\n• Errors increase after autoscaling events\n• Redis session store healthy\nWhich issue is MOST likely?`,
    options:['JVM heap exhaustion','SSL certificate mismatch','Session persistence inconsistency across scaling nodes ✓','DNS propagation delay'],
    correct:2,
    reasoning:'Tests stateful app behaviour · Session affinity · Autoscaling implications · Enterprise LB architecture',
  },
  {
    category:'Linux / Storage',
    scenario:`A Linux application server shows:\n• CPU idle > 70%\n• Load average consistently above 40\n• Users reporting slowness\n• Disk latency spikes intermittently\nWhat is the MOST likely explanation?`,
    options:['CPU saturation','Memory leak','Processes blocked on I/O wait ✓','Excessive context switching'],
    correct:2,
    reasoning:'High load average with low CPU utilisation indicates processes waiting on I/O rather than consuming CPU cycles.',
  },
  {
    category:'Middleware / JVM Engineering',
    scenario:`A JVM-based application shows increasing response times every 6 hours. Heap usage returns to normal after GC, but thread count steadily increases over days.\nWhat is the MOST probable issue?`,
    options:['Heap fragmentation','CPU throttling','Thread leak ✓','DNS resolution delay'],
    correct:2,
    reasoning:'Heap recovers after GC, ruling out memory leaks. Steadily increasing thread count with no corresponding decrease indicates a classic thread leak pattern.',
  },
];

export default function About() {
  const total = CLUSTERS.reduce((s, c) => s + c.qs, 0);

  return (
    <div style={{ fontFamily:"Inter,'Segoe UI',sans-serif" }}>

      {/* ── Hero ── */}
      <div style={{
        background:'linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4338CA 100%)',
        color:'#fff', padding:'48px 48px 40px',
      }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.12em',
          textTransform:'uppercase', opacity:0.6, marginBottom:12 }}>
          I&O · Enterprise Production Engineering
        </div>
        <h1 style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:36,
          fontWeight:400, margin:'0 0 10px', lineHeight:1.2 }}>
          Assessment Question Bank
        </h1>
        <p style={{ fontSize:15, opacity:0.75, margin:'0 0 28px', maxWidth:620, lineHeight:1.6 }}>
          Wealth-Tech &nbsp;·&nbsp; Enterprise Operations &nbsp;·&nbsp;
          Production Engineering &nbsp;·&nbsp; Apps Engineering Support
        </p>
        {/* Stat pills */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {[
            { n:'500+', l:'Total questions' },
            { n:'12',   l:'Technical clusters' },
            { n:'3',    l:'Assessment segments' },
            { n:'Sev-1',l:'Incident-grade difficulty' },
          ].map(({ n, l }) => (
            <div key={l} style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)',
              borderRadius:10, padding:'10px 20px', textAlign:'center',
              border:'1px solid rgba(255,255,255,0.18)' }}>
              <div style={{ fontSize:22, fontWeight:700 }}>{n}</div>
              <div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'36px 48px', maxWidth:1100 }}>

        {/* ── Purpose ── */}
        <section style={{ marginBottom:40 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)',
            marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
            🎯 Purpose
          </h2>
          <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.8, maxWidth:780, margin:0 }}>
            This assessment is purpose-built to identify production engineering talent capable of operating
            mission-critical wealth-management platforms. Questions are grounded in real-world Sev-1 scenarios
            drawn from advisor platforms, trading infrastructure, and enterprise middleware estates — not
            theoretical textbook problems. The goal is to surface engineers who <em>think</em> like senior
            production engineers, not administrators.
          </p>
        </section>

        {/* ── What's assessed ── */}
        <section style={{ marginBottom:40 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:16 }}>
            🔍 What Is Being Assessed
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {ASSESSMENT_AREAS.map(({ title, desc }) => (
              <div key={title} style={{ padding:'16px 18px', borderRadius:10,
                background:'var(--surface)', border:'1px solid var(--border)' }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:6, color:'var(--text)' }}>
                  {title}
                </div>
                <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14, padding:'12px 16px', borderRadius:8,
            background:'#EEF2FF', border:'1px solid #C7D2FE', fontSize:13, color:'#3730A3' }}>
            <strong>Question types:</strong> Scenario-based MCQs · Multi-layer troubleshooting ·
            Log interpretation · Output analysis · Architecture diagram questions ·
            "Best next step" reasoning · Real production incident simulations
          </div>
        </section>

        {/* ── Target roles ── */}
        <section style={{ marginBottom:40 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:16 }}>
            👤 Target Roles
          </h2>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            {['Production Engineering SMEs','Enterprise SREs','Wealth-Tech Infrastructure Specialists'].map(r => (
              <span key={r} style={{ padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:600,
                background:'#F5F3FF', color:'#6D28D9', border:'1px solid #DDD6FE' }}>
                {r}
              </span>
            ))}
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:10, fontWeight:600 }}>
            With wealth-tech as the operating premise, the question bank tests whether a candidate can:
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 24px' }}>
            {[
              'Run mission-critical advisor platforms',
              'Handle high-severity incidents under regulatory pressure',
              'Understand transaction integrity and client-impact blast radius',
              'Operate large-scale distributed middleware estates',
              'Diagnose intermittent failures across infra/app/network/storage layers',
              'Handle latency-sensitive financial workloads',
              'Support hybrid cloud + legacy enterprise environments',
              'Lead bridges during Sev-1 outages',
              'Make risk-aware operational decisions',
              'Think like senior production engineers, not administrators',
            ].map(item => (
              <div key={item} style={{ display:'flex', gap:8, alignItems:'flex-start',
                padding:'5px 0', fontSize:13, color:'var(--text-2)' }}>
                <span style={{ color:'#10B981', flexShrink:0, marginTop:1 }}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* ── Operational scenarios ── */}
        <section style={{ marginBottom:40 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:16 }}>
            🏦 Wealth-Tech Operational Scenarios
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
            {SCENARIOS.map(({ title, desc }) => (
              <div key={title} style={{ display:'flex', gap:12, padding:'12px 14px',
                borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)' }}>
                <span style={{ fontSize:18, flexShrink:0 }}>⚡</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:3 }}>{title}</div>
                  <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Cluster table ── */}
        <section style={{ marginBottom:40 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:16 }}>
            📊 Question Bank by Cluster
          </h2>
          <div className="card" style={{ overflow:'hidden', padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#312E81', color:'#fff' }}>
                  <th style={{ padding:'12px 16px', textAlign:'left', fontWeight:600 }}>Cluster</th>
                  <th style={{ padding:'12px 16px', textAlign:'center', fontWeight:600, width:60 }}>Qs</th>
                  <th style={{ padding:'12px 16px', textAlign:'left', fontWeight:600 }}>Focus Areas</th>
                </tr>
              </thead>
              <tbody>
                {CLUSTERS.map((c, i) => (
                  <tr key={c.cluster}
                    style={{ background: i % 2 === 0 ? '#fff' : '#F8F7FF',
                      borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 16px', fontWeight:600, color:'var(--text)' }}>
                      {c.cluster}
                    </td>
                    <td style={{ padding:'10px 16px', textAlign:'center',
                      fontWeight:700, color:'#6366F1', fontSize:15 }}>
                      {c.qs}
                    </td>
                    <td style={{ padding:'10px 16px', color:'var(--text-2)', lineHeight:1.5 }}>
                      {c.focus}
                    </td>
                  </tr>
                ))}
                <tr style={{ background:'#312E81', color:'#fff' }}>
                  <td style={{ padding:'12px 16px', fontWeight:700 }}>Total</td>
                  <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:800, fontSize:17 }}>
                    {total}
                  </td>
                  <td style={{ padding:'12px 16px', opacity:0.7, fontSize:12 }}>
                    Across 12 technical domains covering the full production engineering stack
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Sample questions ── */}
        <section style={{ marginBottom:40 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:16 }}>
            📝 Sample Questions
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {SAMPLE_QUESTIONS.map((q, qi) => (
              <div key={qi} className="card" style={{ padding:20 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
                  <span style={{ background:'#EEF2FF', color:'#4338CA', padding:'3px 10px',
                    borderRadius:20, fontSize:11, fontWeight:700 }}>
                    {q.category}
                  </span>
                </div>
                {/* Scenario */}
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.8,
                  background:'var(--surface-2)', borderRadius:8, padding:'12px 14px',
                  marginBottom:14, whiteSpace:'pre-line' }}>
                  {q.scenario}
                </div>
                {/* Options */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                  {q.options.map((opt, oi) => (
                    <div key={oi} style={{
                      padding:'8px 12px', borderRadius:6, fontSize:12, lineHeight:1.4,
                      background: oi === q.correct ? '#ECFDF5' : '#F9FAFB',
                      border: `1px solid ${oi === q.correct ? '#6EE7B7' : '#E5E7EB'}`,
                      color: oi === q.correct ? '#065F46' : 'var(--text-2)',
                      fontWeight: oi === q.correct ? 600 : 400,
                    }}>
                      <span style={{ fontWeight:700, marginRight:6 }}>
                        {String.fromCharCode(65+oi)}.
                      </span>
                      {opt.replace(' ✓','')}
                      {oi === q.correct && <span style={{ marginLeft:6, fontSize:11 }}>✓</span>}
                    </div>
                  ))}
                </div>
                {/* Reasoning */}
                <div style={{ fontSize:12, color:'#6B7280', borderLeft:'3px solid #6366F1',
                  paddingLeft:10, fontStyle:'italic', lineHeight:1.6 }}>
                  {q.reasoning}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Core stems ── */}
        <section style={{ marginBottom:40 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:14 }}>
            💬 Core Question Stems
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              '"What would you do and why?"',
              '"What is the most likely root cause?"',
              '"Which metric matters most here?"',
              '"What is the blast radius?"',
              '"Which layer do you isolate first?"',
              '"Why did this fail despite appearing healthy?"',
            ].map(s => (
              <div key={s} style={{ padding:'12px 14px', borderRadius:8,
                background:'linear-gradient(135deg,#F5F3FF,#EEF2FF)',
                border:'1px solid #DDD6FE', fontSize:13, fontWeight:500,
                color:'#4338CA', fontStyle:'italic' }}>
                {s}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
