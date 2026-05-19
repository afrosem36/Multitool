import React from 'react';
import { motion } from 'framer-motion';
import { Award, Shield, Zap, Users, Globe, CheckCircle } from 'lucide-react';
import SEOHead from '../../components/seo/SEOHead';
import '../styles/AboutPage.css';

const AboutUs = () => {
  const teamMembers = [
    {
      name: 'Mohammad Afroz',
      role: 'Founder & Developer',
      bio: 'Built MultiTool to make everyday digital tasks faster and more accessible for everyone. Handles development, tool design, and continuous improvements.'
    },
    {
      name: 'Open Source & Community',
      role: 'Contributors & Feedback',
      bio: 'MultiTool is improved by feedback from real users. Bug reports, feature suggestions, and community input directly shape each update.'
    },
  ];

  const values = [
    {
      icon: Shield,
      title: 'Privacy First',
      description:
        'Your files and data are never uploaded to our servers. All processing happens in your browser, keeping your information completely private.'
    },
    {
      icon: Zap,
      title: 'Performance',
      description:
        'We optimize every tool for speed. Instant processing, minimal waiting, and responsive design across all devices.'
    },
    {
      icon: Users,
      title: 'User Focused',
      description:
        'Every decision is guided by user feedback. We listen, improve, and constantly iterate based on real needs.'
    },
    {
      icon: Award,
      title: 'Quality',
      description:
        'We maintain high standards in code quality, UX design, and reliability. Your experience matters to us.'
    },
    {
      icon: Globe,
      title: 'Accessibility',
      description:
        'Our tools are designed to be accessible to everyone. We follow WCAG guidelines and continually improve.'
    },
    {
      icon: CheckCircle,
      title: 'Transparency',
      description:
        'Clear pricing (everything is free), honest policies, and straightforward privacy practices build trust.'
    }
  ];

  const achievements = [
    { number: '50+', label: 'Free Online Tools' },
    { number: '0', label: 'Files Stored on Servers' },
    { number: '100%', label: 'Browser-Based Processing' },
    { number: '24/7', label: 'Available — No Login Required' }
  ];

  return (
    <>
      <SEOHead
        title="About MultiTool - Our Mission & Team"
        description="Learn about MultiTool's mission to provide free, fast, and reliable online tools. Discover our values, team, and commitment to quality."
        canonicalUrl="/about-us"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'MultiTool',
          url: 'https://multitoolhub.space',
          logo: '/logo.png',
          description:
            'Free online tools for PDF, image, text processing, and utilities. Browser-based, fast, and privacy-focused.',
          founder: {
            '@type': 'Person',
            name: 'Mohammad Afroz'
          },
          contactPoint: {
            '@type': 'ContactPoint',
            url: 'https://multitoolhub.space/contact-us',
            contactType: 'Customer Support'
          }
        }}
      />

      <div className="about-page">
        {/* Hero Section */}
        <section className="about-hero">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="about-hero-content"
            >
              <h1>About MultiTool</h1>
              <p className="about-hero-subtitle">
                Making productivity tools accessible to everyone, everywhere
              </p>
            </motion.div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="about-section mission-section">
          <div className="container">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2>Our Mission</h2>
              <div className="mission-content">
                <p>
                  At MultiTool, our mission is to provide free, fast, and reliable online tools that help people work
                  more efficiently. We believe that productivity software shouldn't be expensive or complicated.
                </p>
                <p>
                  We created MultiTool to eliminate the need to hunt for separate tools across the internet. Whether
                  you need to merge PDFs, compress images, clean text, or generate shareable links, everything is here
                  in one place, completely free.
                </p>
                <p>
                  Our tools are designed with privacy and simplicity as core principles. Nothing you upload gets stored
                  on our servers — all processing happens directly in your browser, keeping your data secure.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Values Section */}
        <section className="about-section values-section">
          <div className="container">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              Our Core Values
            </motion.h2>
            <div className="values-grid">
              {values.map((value, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  className="value-card glass-panel"
                >
                  <value.icon size={32} className="value-icon" />
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Achievements Section */}
        <section className="about-section achievements-section">
          <div className="container">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              By The Numbers
            </motion.h2>
            <div className="achievements-grid">
              {achievements.map((achievement, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  className="achievement-card glass-panel"
                >
                  <div className="achievement-number">{achievement.number}</div>
                  <div className="achievement-label">{achievement.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="about-section team-section">
          <div className="container">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              Our Team
            </motion.h2>
            <p className="section-intro">
              We're a dedicated team of engineers, designers, and product specialists committed to building the best
              tool platform on the web.
            </p>
            <div className="team-grid">
              {teamMembers.map((member, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  className="team-card glass-panel"
                >
                  <div className="team-avatar">{member.name[0]}</div>
                  <h3>{member.name}</h3>
                  <p className="team-role">{member.role}</p>
                  <p className="team-bio">{member.bio}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="about-section why-section">
          <div className="container">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              Why Choose MultiTool?
            </motion.h2>
            <div className="why-list">
              {[
                'Completely free — no hidden charges, subscriptions, or premium tiers',
                'Browser-based — no installation or account required',
                'Privacy-focused — all processing happens locally in your browser',
                'Fast and responsive — instant results on any device',
                'Regularly updated — new tools and improvements added continuously',
                'Simple, direct workflows — pick a tool, use it, done',
                'Honest and transparent — no fake statistics or misleading claims',
                'Open to feedback — real user suggestions shape every update'
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  viewport={{ once: true }}
                  className="why-item"
                >
                  <CheckCircle size={24} />
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="about-section contact-cta-section">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="contact-cta glass-panel gradient-border"
            >
              <h2>Get In Touch</h2>
              <p>Have questions, feedback, or feature requests? We'd love to hear from you.</p>
              <a href="/contact-us" className="btn-primary">
                Contact Us
              </a>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default AboutUs;
