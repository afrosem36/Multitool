import React, { useEffect, useState, useMemo } from 'react';
import styled from 'styled-components';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Activity, Users, Globe, Link as LinkIcon, Loader2, Search, ArrowDown, ArrowUp, Download, Link2, FileSpreadsheet } from 'lucide-react';
import SeoHead from '../components/seo/SEOHead';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  p {
    color: var(--text-secondary);
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 1.5rem;
  
  h3 {
    margin-bottom: 1.5rem;
    font-size: 1.1rem;
    color: var(--text-secondary);
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ListItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(0,0,0,0.1);
  border-radius: 0.5rem;
  
  .name { font-weight: 500; }
  .val { font-family: monospace; color: var(--primary-color); }
`;

const TableWrapper = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  overflow: hidden;
  margin-top: 1rem;
  
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  
  th, td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  th {
    background: rgba(0,0,0,0.1);
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
    
    &:hover {
      background: rgba(0,0,0,0.2);
    }
  }
  
  td {
    color: var(--text-primary);
  }

  tr:last-child td {
    border-bottom: none;
  }
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
  
  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    max-width: 400px;
    
    input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--surface-color);
      color: var(--text-primary);
      outline: none;
      
      &:focus {
        border-color: var(--accent-primary);
      }
    }
    
    svg {
      position: absolute;
      left: 12px;
      color: var(--text-secondary);
    }
  }
`;

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  useEffect(() => {
    fetch('/api/share/analytics')
      .then(res => res.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedLinks = useMemo(() => {
    if (!data?.links) return [];
    
    let result = [...data.links];
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(link => {
        return link.slug.toLowerCase().includes(lower) || 
               (link.longUrl && link.longUrl.toLowerCase().includes(lower));
      });
    }
    
    result.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [data?.links, searchTerm, sortConfig]);

  const mostClicked = useMemo(() => {
    if (!data?.links || data.links.length === 0) return null;
    return data.links.reduce((prev, current) => (prev.downloadCount > current.downloadCount) ? prev : current);
  }, [data?.links]);

  const exportCSV = () => {
    if (!filteredAndSortedLinks.length) {
      toast.error('No data to export');
      return;
    }
    
    const headers = ['Alias', 'Destination URL', 'Leads Collected', 'Clicks', 'Created At', 'Last Clicked'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedLinks.map(l => 
        [
          l.slug, 
          l.longUrl, 
          l.leadsCount || 0,
          l.downloadCount, 
          l.createdAt || l.uploadedAt, 
          l.lastClicked || 'Never'
        ].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'analytics_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Export downloaded!');
  };

  const exportXLSX = () => {
    if (!filteredAndSortedLinks.length) {
      toast.error('No data to export');
      return;
    }

    const worksheetData = filteredAndSortedLinks.map(l => ({
      Alias: l.slug,
      'Destination URL': l.longUrl,
      'Leads Collected': l.leadsCount || 0,
      Clicks: l.downloadCount,
      'Created At': new Date(l.createdAt || l.uploadedAt).toLocaleString(),
      'Last Clicked': l.lastClicked ? new Date(l.lastClicked).toLocaleString() : 'Never'
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytics");
    XLSX.writeFile(wb, "analytics_export.xlsx");
    toast.success('XLSX Export downloaded!');
  };

  if (loading) return (
    <Container style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Loader2 size={48} className="spin text-gradient" />
    </Container>
  );

  if (error) return (
    <Container>
      <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '2rem' }}>
        <h2>Error Loading Analytics</h2>
        <p>{error}</p>
      </div>
    </Container>
  );

  return (
    <Container>
      <SeoHead title="Analytics Dashboard" description="Global link performance and audience insights." />
      
      <Header>
        <h1 className="text-gradient">Analytics Overview</h1>
        <p>Global link performance, top referrers, and collected user insights.</p>
      </Header>

      <StatsGrid>
        <StatCard>
          <div className="header"><Activity size={16} /> Total Clicks</div>
          <div className="value">{data?.totalClicks || 0}</div>
        </StatCard>
        <StatCard>
          <div className="header"><Link2 size={16} /> URLs Created</div>
          <div className="value">{data?.links?.length || 0}</div>
        </StatCard>
        <StatCard>
          <div className="header"><Users size={16} /> Unique Visitors</div>
          <div className="value">{data?.uniqueVisitors || 0}</div>
        </StatCard>
        <StatCard>
          <div className="header"><Activity size={16} /> Most Clicked URL</div>
          <div className="value" title={mostClicked?.longUrl} style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>
            {mostClicked ? `/s/${mostClicked.slug} (${mostClicked.downloadCount})` : 'N/A'}
          </div>
        </StatCard>
      </StatsGrid>

      <ChartsGrid>
        <ChartCard>
          <h3>Clicks Over Time</h3>
          <div style={{ height: 300, width: '100%' }}>
            {data?.sparkline?.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={data.sparkline}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" tickMargin={10} />
                  <YAxis stroke="var(--text-secondary)" tickMargin={10} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--primary-color)' }}
                  />
                  <Area type="monotone" dataKey="clicks" stroke="#60a5fa" fillOpacity={1} fill="url(#colorClicks)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                No click data available yet.
              </div>
            )}
          </div>
        </ChartCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ChartCard>
            <h3><Globe size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} /> Top Countries</h3>
            <List>
              {data?.topCountries?.length > 0 ? data.topCountries.map(c => (
                <ListItem key={c.name}>
                  <span className="name">{c.name}</span>
                  <span className="val">{c.value}</span>
                </ListItem>
              )) : <div style={{ color: 'var(--text-secondary)' }}>No data yet</div>}
            </List>
          </ChartCard>
          <ChartCard>
            <h3><LinkIcon size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} /> Top Referrers</h3>
            <List>
              {data?.topReferers?.length > 0 ? data.topReferers.map(r => (
                <ListItem key={r.name}>
                  <span className="name">{r.name}</span>
                  <span className="val">{r.value}</span>
                </ListItem>
              )) : <div style={{ color: 'var(--text-secondary)' }}>No data yet</div>}
            </List>
          </ChartCard>
        </div>
      </ChartsGrid>

      {/* URL Table Section */}
      <div style={{ marginTop: '3rem' }}>
        <Header style={{ marginBottom: '1rem' }}>
          <h2>URL Management & Data</h2>
        </Header>
        
        <Toolbar>
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by alias, URL..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-secondary" onClick={exportCSV}>
              <Download size={18} /> Export CSV
            </button>
            <button className="btn-primary" onClick={exportXLSX}>
              <FileSpreadsheet size={18} /> Export XLSX
            </button>
          </div>
        </Toolbar>

        <TableWrapper>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('slug')}>
                    Alias {sortConfig.key === 'slug' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}
                  </th>
                  <th onClick={() => handleSort('longUrl')}>
                    Destination {sortConfig.key === 'longUrl' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}
                  </th>
                  <th onClick={() => handleSort('leadsCount')}>
                    Leads {sortConfig.key === 'leadsCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}
                  </th>
                  <th onClick={() => handleSort('downloadCount')}>
                    Clicks {sortConfig.key === 'downloadCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}
                  </th>
                  <th onClick={() => handleSort('createdAt')}>
                    Created {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}
                  </th>
                  <th onClick={() => handleSort('lastClicked')}>
                    Last Clicked {sortConfig.key === 'lastClicked' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedLinks.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No URLs found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedLinks.map((link) => (
                    <tr key={link.slug}>
                      <td style={{ fontWeight: '500', color: 'var(--accent-primary)' }}>/s/{link.slug}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={link.longUrl}>
                        {link.longUrl}
                      </td>
                      <td style={{ fontWeight: '600', color: link.leadsCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                        {link.leadsCount} {link.leadsCount === 1 ? 'Lead' : 'Leads'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{link.downloadCount}</td>
                      <td>{new Date(link.createdAt || link.uploadedAt).toLocaleDateString()}</td>
                      <td>{link.lastClicked ? new Date(link.lastClicked).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TableWrapper>
      </div>

      {/* Collected Leads Section */}
      <div style={{ marginTop: '3rem' }}>
        <Header style={{ marginBottom: '1rem' }}>
          <h2>Collected Visitor Leads</h2>
          <p>Contact information collected from visitors before they accessed your short links.</p>
        </Header>

        <Toolbar style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => {
            if (!data?.leads?.length) {
              toast.error('No leads to export');
              return;
            }
            const worksheetData = data.leads.map(l => ({
              'Link Alias': l.slug,
              'Visitor Name': l.name,
              'Contact Info': l.contact,
              'Time Collected': new Date(l.timestamp).toLocaleString(),
              'IP Address': l.ip || 'Unknown'
            }));
            const ws = XLSX.utils.json_to_sheet(worksheetData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Visitor Leads");
            XLSX.writeFile(wb, "visitor_leads_export.xlsx");
            toast.success('Leads Exported!');
          }}>
            <FileSpreadsheet size={18} /> Export Leads XLSX
          </button>
        </Toolbar>

        <TableWrapper>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Visitor Name</th>
                  <th>Contact Info</th>
                  <th>Clicked Link</th>
                  <th>Time Collected</th>
                </tr>
              </thead>
              <tbody>
                {!data?.leads || data.leads.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No visitor leads collected yet. Enable Data Collection when generating a link to start collecting leads.
                    </td>
                  </tr>
                ) : (
                  data.leads.map((lead, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: '500' }}>{lead.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{lead.contact}</td>
                      <td>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>/s/{lead.slug}</span>
                      </td>
                      <td>{new Date(lead.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TableWrapper>
      </div>
    </Container>
  );
}
