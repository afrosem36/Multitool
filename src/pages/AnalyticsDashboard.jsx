import React, { useEffect, useState, useMemo } from 'react';
import styled from 'styled-components';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Activity, Users, Globe, Link as LinkIcon, Loader2, Search, ArrowDown, ArrowUp, Download, Link2, FileSpreadsheet, Info } from 'lucide-react';
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

import { useSearchParams } from 'react-router-dom';

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState(() => {
    return searchParams.get('search') || '';
  });
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatExpiryCountdown = (expiresAt) => {
    if (!expiresAt) return 'Never';

    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return 'Expired';

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

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
    const isFiles = searchParams.get('type') === 'files';
    const activeLinks = filteredAndSortedLinks.filter(l => isFiles ? l.originalName : !l.originalName);
    if (!activeLinks.length) {
      toast.error('No data to export');
      return;
    }
    
    const headers = isFiles 
      ? ['Alias', 'Original File', 'Size (MB)', 'Clicks', 'Uploaded At', 'Expires At', 'Expiry Status', 'Last Clicked']
      : ['Alias', 'Destination URL', 'Leads Collected', 'Clicks', 'Created At', 'Last Clicked'];
      
    const csvContent = [
      headers.join(','),
      ...activeLinks.map(l => isFiles 
        ? [l.slug, l.originalName, (l.size / 1024 / 1024).toFixed(2), l.downloadCount, l.uploadedAt, l.expiresAt || 'Never', l.isExpired ? 'Expired' : formatExpiryCountdown(l.expiresAt), l.lastClicked || 'Never'].join(',')
        : [l.slug, l.longUrl, l.leadsCount || 0, l.downloadCount, l.createdAt, l.lastClicked || 'Never'].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', isFiles ? 'shared_files_analytics.csv' : 'url_analytics_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Export downloaded!');
  };

  const exportXLSX = () => {
    const isFiles = searchParams.get('type') === 'files';
    const activeLinks = filteredAndSortedLinks.filter(l => isFiles ? l.originalName : !l.originalName);
    
    if (!activeLinks.length) {
      toast.error('No data to export');
      return;
    }

    const worksheetData = activeLinks.map(l => isFiles ? ({
      Alias: l.slug,
      'Original File': l.originalName,
      'Size (MB)': parseFloat((l.size / 1024 / 1024).toFixed(2)),
      Clicks: l.downloadCount,
      'Uploaded At': new Date(l.uploadedAt).toLocaleString(),
      'Expires At': l.expiresAt ? new Date(l.expiresAt).toLocaleString() : 'Never',
      'Expiry Status': l.isExpired ? 'Expired' : formatExpiryCountdown(l.expiresAt),
      'Last Clicked': l.lastClicked ? new Date(l.lastClicked).toLocaleString() : 'Never'
    }) : ({
      Alias: l.slug,
      'Destination URL': l.longUrl,
      'Leads Collected': l.leadsCount || 0,
      Clicks: l.downloadCount,
      'Created At': new Date(l.createdAt).toLocaleString(),
      'Last Clicked': l.lastClicked ? new Date(l.lastClicked).toLocaleString() : 'Never'
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isFiles ? "Shared Files" : "Analytics");
    XLSX.writeFile(wb, isFiles ? "shared_files_analytics.xlsx" : "url_analytics_export.xlsx");
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
        {data?.isVercel && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: 'rgba(234, 179, 8, 0.1)', 
            border: '1px solid rgba(234, 179, 8, 0.2)', 
            borderRadius: '8px',
            color: '#f59e0b',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Info size={18} />
            <span><strong>Note:</strong> Production share data is now expected to live in Cloudflare R2. If analytics look empty after deploy, verify the R2 environment variables in Vercel.</span>
          </div>
        )}
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

      {/* URL / File Table Section */}
      <div style={{ marginTop: '3rem' }}>
        <Header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2>Link Management & Data</h2>
            <p>Manage your shortened URLs and shared files.</p>
          </div>
        </Header>
        
        {/* TABS */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => {
              setSearchParams(prev => { prev.set('type', 'urls'); return prev; });
              setSearchTerm('');
            }}
            style={{ 
              background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer',
              color: searchParams.get('type') !== 'files' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: searchParams.get('type') !== 'files' ? '2px solid var(--primary-color)' : 'none'
            }}
          >
            Shortened URLs
          </button>
          <button 
            onClick={() => {
              setSearchParams(prev => { prev.set('type', 'files'); return prev; });
              setSearchTerm('');
            }}
            style={{ 
              background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer',
              color: searchParams.get('type') === 'files' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: searchParams.get('type') === 'files' ? '2px solid var(--primary-color)' : 'none'
            }}
          >
            Shared Files
          </button>
        </div>
        
        <Toolbar>
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by alias, URL, or filename..." 
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
                  <th onClick={() => handleSort('slug')}>Alias {sortConfig.key === 'slug' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                  {searchParams.get('type') === 'files' ? (
                    <>
                      <th onClick={() => handleSort('originalName')}>Original File {sortConfig.key === 'originalName' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                      <th onClick={() => handleSort('size')}>Size {sortConfig.key === 'size' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                      <th onClick={() => handleSort('expiresAt')}>Expiry {sortConfig.key === 'expiresAt' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                      <th>Status</th>
                    </>
                  ) : (
                    <>
                      <th onClick={() => handleSort('longUrl')}>Destination {sortConfig.key === 'longUrl' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                      <th onClick={() => handleSort('leadsCount')}>Leads {sortConfig.key === 'leadsCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                    </>
                  )}
                  <th onClick={() => handleSort('downloadCount')}>Clicks {sortConfig.key === 'downloadCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                  <th onClick={() => handleSort('createdAt')}>Created {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                  <th onClick={() => handleSort('lastClicked')}>Last Clicked {sortConfig.key === 'lastClicked' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ display:'inline' }}/> : <ArrowDown size={14} style={{ display:'inline' }}/>)}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedLinks.filter(l => searchParams.get('type') === 'files' ? l.originalName : !l.originalName).length === 0 ? (
                  <tr>
                    <td colSpan={searchParams.get('type') === 'files' ? 8 : 6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No {searchParams.get('type') === 'files' ? 'files' : 'URLs'} found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedLinks
                    .filter(l => searchParams.get('type') === 'files' ? l.originalName : !l.originalName)
                    .map((link) => (
                    <tr key={link.slug}>
                      <td style={{ fontWeight: '500', color: 'var(--accent-primary)' }}>/s/{link.slug}</td>
                      {searchParams.get('type') === 'files' ? (
                        <>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={link.originalName}>{link.originalName}</td>
                          <td>{(link.size / 1024 / 1024).toFixed(2)} MB</td>
                          <td>{link.expiresAt ? new Date(link.expiresAt).toLocaleString() : 'Never'}</td>
                          <td style={{ fontWeight: '600', color: link.isExpired ? '#ef4444' : 'var(--primary-color)' }}>
                            {link.isExpired ? 'Link Expired' : formatExpiryCountdown(link.expiresAt)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={link.longUrl}>{link.longUrl}</td>
                          <td style={{ fontWeight: '600', color: link.leadsCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                            {link.leadsCount} {link.leadsCount === 1 ? 'Lead' : 'Leads'}
                          </td>
                        </>
                      )}
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

      {/* Collected Leads Section - Only show for URLs */}
      {searchParams.get('type') !== 'files' && (
        <div style={{ marginTop: '3rem' }}>
          <Header style={{ marginBottom: '1rem' }}>
            <h2>Collected Visitor Leads</h2>
            <p>Contact information collected from visitors before they accessed your short links.</p>
          </Header>

          <Toolbar style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => {
              const filteredLeads = data?.leads ? data.leads.filter(l => l.slug.toLowerCase().includes(searchTerm.toLowerCase())) : [];
              if (!filteredLeads.length) {
                toast.error('No leads to export');
                return;
              }
              const worksheetData = filteredLeads.map(l => ({
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
                  {!data?.leads || data.leads.filter(l => l.slug.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        No visitor leads collected yet for this query. Enable Data Collection when generating a link to start collecting leads.
                      </td>
                    </tr>
                  ) : (
                    data.leads.filter(l => l.slug.toLowerCase().includes(searchTerm.toLowerCase())).map((lead, index) => (
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
      )}
    </Container>
  );
}
