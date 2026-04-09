"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import { C } from "@/lib/colors";
import Head from 'next/head';

export const dynamic = 'force-dynamic'

type BlogPost = {
  id: number;
  title: string;
  body: string;
  published_at: string;
  slug: string;
  cover_image_url: string | null;
  extra_image_urls: string[];
  meta_description: string | null;
  meta_keywords: string | null;
  og_image_url: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// SEO Component - generates meta tags and structured data
function BlogSEO({ post }: { post: BlogPost }) {
  const baseUrl = "www.chrissolo.dev"; // Update when you add your domain
  const postUrl = `${baseUrl}/blog/${post.slug}`;
  const ogImage = post.og_image_url || post.cover_image_url || `${baseUrl}/og-default.jpg`;
  const description = post.meta_description || post.body.substring(0, 160) + "...";
  
  // Structured data for Google rich snippets
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": description,
    "image": ogImage,
    "datePublished": post.published_at,
    "dateModified": post.published_at,
    "author": {
      "@type": "Person",
      "name": "Chris Solorzano",
      "url": baseUrl
    },
    "publisher": {
      "@type": "Organization",
      "name": "Chris Solo Photography",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.png`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": postUrl
    }
  };

  useEffect(() => {
    // Update document title
    document.title = `${post.title} | Chris Solo Photography`;
    
    // Update meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Basic meta tags
    updateMetaTag('description', description);
    if (post.meta_keywords) {
      updateMetaTag('keywords', post.meta_keywords);
    }

    // Open Graph tags (Facebook, LinkedIn)
    updateMetaTag('og:title', post.title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:url', postUrl, true);
    updateMetaTag('og:type', 'article', true);
    updateMetaTag('og:site_name', 'Chris Solo Photography', true);
    updateMetaTag('article:published_time', post.published_at, true);
    updateMetaTag('article:author', 'Chris Solorzano', true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', post.title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:creator', '@soloxsnaps');

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = postUrl;

    // Add structured data
    let script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);

  }, [post]);

  return null; // This component only updates the head, doesn't render anything
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug]       = useState<string | null>(null);
  const [post, setPost]       = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    async function fetchPost() {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .single();
        if (error || !data) { setNotFound(true); return; }
        setPost(data);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background:C.bg}}>
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-3" style={{borderColor:C.p1,borderTopColor:"transparent"}}/>
          <p className="text-sm font-bold text-slate-400">Loading post...</p>
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{background:C.bg}}>
        <h1 className="text-6xl font-black mb-4" style={{color:C.p1}}>404</h1>
        <p className="text-xl font-bold text-slate-900 mb-6">Post not found</p>
        <Link href="/blog" className="px-6 py-3 rounded-full font-bold text-sm text-white transition-all hover:opacity-90" style={{background:C.grad12}}>
          ← Back to blog
        </Link>
      </div>
    );
  }

  const paragraphs = post.body.split('\n\n').filter(Boolean);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{background:C.bg}}>
      {/* SEO Component - adds meta tags and structured data */}
      <BlogSEO post={post} />

      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0" style={{background:`radial-gradient(circle at 20% 30%, ${C.p1_08}, transparent 40%)`}}/>
        <div className="absolute inset-0" style={{background:`radial-gradient(circle at 80% 70%, ${C.p2_08}, transparent 40%)`}}/>
        <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 50%, ${C.p3_08}, transparent 50%)`}}/>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        {/* Back button */}
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-bold mb-8 transition-colors hover:opacity-70" style={{color:C.p1}}>
          ← Back to blog
        </Link>

        {/* Cover image */}
        {post.cover_image_url && (
          <div className="w-full aspect-[2/1] rounded-2xl overflow-hidden mb-8 shadow-xl">
            <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover"/>
          </div>
        )}

        {/* Post header */}
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight" style={{color:C.text}}>{post.title}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <time dateTime={post.published_at}>
              {formatDate(post.published_at)} at {formatTime(post.published_at)}
            </time>
            <span>·</span>
            <span>By Chris Solorzano</span>
          </div>
        </header>

        {/* Post body */}
        <article className="prose prose-lg max-w-none mb-12">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-slate-700 leading-relaxed mb-6" style={{fontSize:"1.0625rem"}}>
              {p}
            </p>
          ))}
        </article>

        {/* Extra images grid */}
        {post.extra_image_urls && post.extra_image_urls.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
            {post.extra_image_urls.map((url, i) => (
              <button
                key={i}
                onClick={() => setLightbox(url)}
                className="aspect-square rounded-xl overflow-hidden hover:scale-105 transition-transform cursor-pointer shadow-md"
              >
                <img src={url} alt={`${post.title} ${i + 1}`} className="w-full h-full object-cover"/>
              </button>
            ))}
          </div>
        )}

        {/* Share section */}
        <div className="border-t border-slate-200 pt-8 mb-12">
          <p className="text-sm font-bold text-slate-400 mb-4">SHARE THIS POST</p>
          <div className="flex gap-3">
            <a 
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{background:C.p1_10,color:C.p1}}
            >
              Twitter
            </a>
            <a 
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{background:C.p2_10,color:C.p2}}
            >
              Facebook
            </a>
            <a 
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{background:C.p3_10,color:C.p3}}
            >
              LinkedIn
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl p-8 text-center shadow-xl" style={{background:`linear-gradient(135deg,${C.p1_10},${C.p2_08})`}}>
          <h3 className="text-2xl font-black mb-3" style={{color:C.p1}}>Ready to book your shoot?</h3>
          <p className="text-slate-600 mb-6">Let's capture your graduation moments</p>
          <a href="https://soloxsnaps.com/contact" className="inline-block px-8 py-3 rounded-full font-bold text-sm text-white transition-all hover:opacity-90" style={{background:C.grad12}}>
            Book Now →
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div 
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md"
          style={{background:"rgba(0,0,0,0.9)"}}
        >
          <button onClick={() => setLightbox(null)} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 text-white text-2xl flex items-center justify-center hover:bg-white/20 transition-colors">
            ✕
          </button>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full rounded-xl shadow-2xl"/>
        </div>
      )}
    </div>
  );
}