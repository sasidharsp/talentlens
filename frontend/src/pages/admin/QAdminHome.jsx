import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Plus, Search, BookOpen, ChevronRight, Users, Lightbulb } from 'lucide-react';
import api from '../../api/client';

export default function QAdminHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_questions: 0, total_tags: 0 });

  useEffect(() => {
    api.get('/inperson/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const cards = [
    {
      icon: Tag,
      color: '#6366F1',
      title: 'Browse by Tag',
      desc: 'Questions are organised by topic tags. Click a tag on the In-person Interview page to filter questions instantly.',
    },
    {
      icon: Search,
      color: '#10B981',
      title: 'Find Questions Fast',
      desc: 'All available tags appear as clickable chips at the top of the question bank. Select one to see only those questions.',
    },
    {
      icon: Plus,
      color: '#F59E0B',
      title: 'Add Questions',
      desc: 'Contribute questions using the Add Question form. Assign an existing tag or create a new one — the question and expected answer are both required.',
    },
    {
      icon: Lightbulb,
      color: '#8B5CF6',
      title: 'Answers Visible',
      desc: 'Expected answers are shown alongside each question so you walk into every interview fully prepared.',
    },
  ];

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, fontWeight:400 }}>
            Welcome to the Interview Portal
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginTop:2 }}>
            Your hub for in-person interview preparation
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/inperson')}>
          Go to Questions <ChevronRight size={15} />
        </button>
      </div>

      <div className="admin-content page-fade" style={{ maxWidth: 860 }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:32 }}>
          {[
            { label:'Questions in bank', value: stats.total_questions, icon: BookOpen, color:'#6366F1' },
            { label:'Topic tags',        value: stats.total_tags,      icon: Tag,      color:'#10B981' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card"
              style={{ padding:'20px 24px', display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:44, height:44, borderRadius:12,
                background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon size={22} color={color} />
              </div>
              <div>
                <div style={{ fontSize:28, fontWeight:700, color:'var(--text)' }}>{value}</div>
                <div style={{ fontSize:13, color:'var(--text-2)' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* How to use */}
        <div className="card" style={{ padding:28, marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:20,
            display:'flex', alignItems:'center', gap:8 }}>
            <Users size={18} color="var(--primary)" /> How to use this portal
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {cards.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} style={{ padding:'16px 18px', borderRadius:10,
                background:'var(--surface-2)', border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:32, height:32, borderRadius:8,
                    background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <span style={{ fontWeight:600, fontSize:14 }}>{title}</span>
                </div>
                <p style={{ fontSize:13, color:'var(--text-2)', margin:0, lineHeight:1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick tip */}
        <div style={{ padding:'14px 18px', borderRadius:10,
          background:'var(--primary)10', border:'1px solid var(--primary)30',
          fontSize:13, color:'var(--text-2)', lineHeight:1.6 }}>
          <strong style={{ color:'var(--primary)' }}>Tip:</strong> When adding questions,
          use consistent tag names (e.g. <em>Leadership</em>, <em>Technical</em>, <em>Behavioural</em>)
          so the question bank stays organised and easy to browse.
        </div>
      </div>
    </div>
  );
}
