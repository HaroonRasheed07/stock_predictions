// // // // // // 'use client';

// // // // // // export const dynamic = 'force-dynamic';

// // // // // // import { motion } from 'framer-motion';
// // // // // // import { Button } from '@/components/ui/button';
// // // // // // import { Card, CardContent } from '@/components/ui/card';
// // // // // // import { TrendingUp, BarChart3, Brain, Shield, Zap, Globe } from 'lucide-react';
// // // // // // import Link from 'next/link';
// // // // // // import { useEffect, useState } from 'react';
// // // // // // import { mockStocks, mockCrypto } from '@/lib/mockData';

// // // // // // export default function Home() {
// // // // // //   const normalizedStocks = mockStocks.slice(0, 5).map(s => ({
// // // // // //     symbol: s.symbol,
// // // // // //     price: s.price,
// // // // // //     change: s.change,
// // // // // //   }));
// // // // // //   const normalizedCrypto = mockCrypto.slice(0, 3).map(c => ({
// // // // // //     symbol: c.symbol,
// // // // // //     price: c.price,
// // // // // //     change: c.change24h,
// // // // // //   }));
  
// // // // // //   const [tickerData, setTickerData] = useState([...normalizedStocks, ...normalizedCrypto]);

// // // // // //   useEffect(() => {
// // // // // //     const interval = setInterval(() => {
// // // // // //       setTickerData((prev) =>
// // // // // //         prev.map((item) => ({
// // // // // //           ...item,
// // // // // //           price: item.price * (1 + (Math.random() - 0.5) * 0.002),
// // // // // //           change: item.change + (Math.random() - 0.5) * 0.1,
// // // // // //         }))
// // // // // //       );
// // // // // //     }, 5000);

// // // // // //     return () => clearInterval(interval);
// // // // // //   }, []);

// // // // // //   const features = [
// // // // // //     {
// // // // // //       icon: TrendingUp,
// // // // // //       title: 'Stock Market Analytics',
// // // // // //       description: 'Real-time data, technical indicators, and AI-powered predictions for equities.',
// // // // // //       link: '/markets/stock',
// // // // // //       gradient: 'from-blue-500 to-cyan-500',
// // // // // //     },
// // // // // //     {
// // // // // //       icon: Globe,
// // // // // //       title: 'Cryptocurrency Intelligence',
// // // // // //       description: 'Track top cryptocurrencies with sentiment analysis and price forecasting.',
// // // // // //       link: '/markets/crypto',
// // // // // //       gradient: 'from-purple-500 to-pink-500',
// // // // // //     },
// // // // // //     {
// // // // // //       icon: BarChart3,
// // // // // //       title: 'E-commerce Insights',
// // // // // //       description: 'Product analytics, fake review detection, and pricing intelligence.',
// // // // // //       link: '/markets/ecommerce',
// // // // // //       gradient: 'from-orange-500 to-red-500',
// // // // // //     },
// // // // // //   ];

// // // // // //   const capabilities = [
// // // // // //     {
// // // // // //       icon: Brain,
// // // // // //       title: 'AI-Powered Predictions',
// // // // // //       description: 'LSTM model for accurate future price forecasting',
// // // // // //     },
// // // // // //     {
// // // // // //       icon: Shield,
// // // // // //       title: 'Sentiment Analysis',
// // // // // //       description: 'Real-time social media and news sentiment tracking',
// // // // // //     },
// // // // // //     {
// // // // // //       icon: Zap,
// // // // // //       title: 'Real-Time Data',
// // // // // //       description: 'Live market updates every 10 seconds',
// // // // // //     },
// // // // // //   ];

// // // // // //   return (
// // // // // //     <div className="min-h-screen">
// // // // // //       {/* Hero Section */}
// // // // // //       <section className="relative overflow-hidden gradient-hero py-20 md:py-32">
// // // // // //         <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
// // // // // //         <div className="container mx-auto px-4 relative z-10">
// // // // // //           <motion.div
// // // // // //             initial={{ opacity: 0, y: 20 }}
// // // // // //             animate={{ opacity: 1, y: 0 }}
// // // // // //             transition={{ duration: 0.6 }}
// // // // // //             className="text-center max-w-4xl mx-auto"
// // // // // //           >
// // // // // //             <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
// // // // // //               <span className="relative flex h-2 w-2">
// // // // // //                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
// // // // // //                 <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
// // // // // //               </span>
// // // // // //               <span className="text-sm font-medium">Live Market Data</span>
// // // // // //             </div>

// // // // // //             <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
// // // // // //               Real-time Market Intelligence &{' '}
// // // // // //               <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
// // // // // //                 Predictive Analytics
// // // // // //               </span>
// // // // // //             </h1>

// // // // // //             <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto">
// // // // // //               Professional-grade analytics for stocks, crypto, and e-commerce with AI-powered forecasting
// // // // // //             </p>

// // // // // //             <div className="flex flex-col sm:flex-row gap-4 justify-center">
// // // // // //               <Link href="/markets/stock">
// // // // // //                 <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8">
// // // // // //                   Explore Markets
// // // // // //                 </Button>
// // // // // //               </Link>
// // // // // //               <Link href="/about">
// // // // // //                 <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-lg px-8">
// // // // // //                   Learn More
// // // // // //                 </Button>
// // // // // //               </Link>
// // // // // //             </div>
// // // // // //           </motion.div>
// // // // // //         </div>
// // // // // //       </section>

// // // // // //       {/* Live Ticker */}
// // // // // //       <div className="bg-card/50 border-y border-border/40 backdrop-blur-sm py-4 overflow-hidden">
// // // // // //         <motion.div
// // // // // //           animate={{ x: ['0%', '-50%'] }}
// // // // // //           transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
// // // // // //           className="flex space-x-8 whitespace-nowrap"
// // // // // //         >
// // // // // //           {[...tickerData, ...tickerData].map((item, idx) => (
// // // // // //             <div key={idx} className="flex items-center space-x-2">
// // // // // //               <span className="font-semibold">{item.symbol}</span>
// // // // // //               <span className="text-foreground/70">${item.price.toFixed(2)}</span>
// // // // // //               <span className={item.change >= 0 ? 'text-success' : 'text-destructive'}>
// // // // // //                 {item.change >= 0 ? '+' : ''}
// // // // // //                 {item.change.toFixed(2)}
// // // // // //               </span>
// // // // // //             </div>
// // // // // //           ))}
// // // // // //         </motion.div>
// // // // // //       </div>

// // // // // //       {/* Features Grid */}
// // // // // //       <section className="py-20">
// // // // // //         <div className="container mx-auto px-4">
// // // // // //           <motion.div
// // // // // //             initial={{ opacity: 0 }}
// // // // // //             whileInView={{ opacity: 1 }}
// // // // // //             viewport={{ once: true }}
// // // // // //             className="text-center mb-12"
// // // // // //           >
// // // // // //             <h2 className="text-3xl md:text-4xl font-bold mb-4">Multi-Market Intelligence</h2>
// // // // // //             <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
// // // // // //               Comprehensive analytics across multiple asset classes and platforms
// // // // // //             </p>
// // // // // //           </motion.div>

// // // // // //           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
// // // // // //             {features.map((feature, idx) => (
// // // // // //               <motion.div
// // // // // //                 key={idx}
// // // // // //                 initial={{ opacity: 0, y: 20 }}
// // // // // //                 whileInView={{ opacity: 1, y: 0 }}
// // // // // //                 viewport={{ once: true }}
// // // // // //                 transition={{ delay: idx * 0.1 }}
// // // // // //               >
// // // // // //                 <Link href={feature.link}>
// // // // // //                   <Card className="glass hover:glow-primary transition-all duration-300 cursor-pointer h-full group">
// // // // // //                     <CardContent className="p-6">
// // // // // //                       <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
// // // // // //                         <feature.icon className="h-6 w-6 text-white" />
// // // // // //                       </div>
// // // // // //                       <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
// // // // // //                       <p className="text-muted-foreground">{feature.description}</p>
// // // // // //                     </CardContent>
// // // // // //                   </Card>
// // // // // //                 </Link>
// // // // // //               </motion.div>
// // // // // //             ))}
// // // // // //           </div>
// // // // // //         </div>
// // // // // //       </section>

// // // // // //       {/* Capabilities */}
// // // // // //       <section className="py-20 bg-muted/30">
// // // // // //         <div className="container mx-auto px-4">
// // // // // //           <motion.div
// // // // // //             initial={{ opacity: 0 }}
// // // // // //             whileInView={{ opacity: 1 }}
// // // // // //             viewport={{ once: true }}
// // // // // //             className="text-center mb-12"
// // // // // //           >
// // // // // //             <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced Capabilities</h2>
// // // // // //             <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
// // // // // //               Powered by cutting-edge machine learning and real-time data processing
// // // // // //             </p>
// // // // // //           </motion.div>

// // // // // //           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
// // // // // //             {capabilities.map((cap, idx) => (
// // // // // //               <motion.div
// // // // // //                 key={idx}
// // // // // //                 initial={{ opacity: 0, scale: 0.9 }}
// // // // // //                 whileInView={{ opacity: 1, scale: 1 }}
// // // // // //                 viewport={{ once: true }}
// // // // // //                 transition={{ delay: idx * 0.1 }}
// // // // // //                 className="text-center"
// // // // // //               >
// // // // // //                 <div className="w-16 h-16 rounded-2xl bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
// // // // // //                   <cap.icon className="h-8 w-8 text-white" />
// // // // // //                 </div>
// // // // // //                 <h3 className="text-xl font-semibold mb-2">{cap.title}</h3>
// // // // // //                 <p className="text-muted-foreground">{cap.description}</p>
// // // // // //               </motion.div>
// // // // // //             ))}
// // // // // //           </div>
// // // // // //         </div>
// // // // // //       </section>

// // // // // //       {/* CTA Section */}
// // // // // //       <section className="py-20">
// // // // // //         <div className="container mx-auto px-4">
// // // // // //           <motion.div
// // // // // //             initial={{ opacity: 0, scale: 0.95 }}
// // // // // //             whileInView={{ opacity: 1, scale: 1 }}
// // // // // //             viewport={{ once: true }}
// // // // // //             className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto glow-primary"
// // // // // //           >
// // // // // //             <h2 className="text-3xl md:text-4xl font-bold mb-4">
// // // // // //               Ready to Transform Your Trading Strategy?
// // // // // //             </h2>
// // // // // //             <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
// // // // // //               Join thousands of traders using AI Driven Market Analysis for data-driven decisions
// // // // // //             </p>
// // // // // //             <Link href="/markets/stock">
// // // // // //               <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8">
// // // // // //                 Get Started Now
// // // // // //               </Button>
// // // // // //             </Link>
// // // // // //           </motion.div>
// // // // // //         </div>
// // // // // //       </section>
// // // // // //     </div>
// // // // // //   );
// // // // // // }






// 'use client';

// import { motion } from 'framer-motion';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent } from '@/components/ui/card';
// import { TrendingUp, BarChart3, Brain, Shield, Zap, Globe } from 'lucide-react';
// import Link from 'next/link';
// import { useEffect, useState } from 'react';

// // Mock crypto data for initial load
// const mockCrypto = [
//   { symbol: "BTCUSDT", price: 34900, change: 1.2 },
//   { symbol: "ETHUSDT", price: 2300, change: -0.5 },
//   { symbol: "BNBUSDT", price: 340, change: 0.9 },
// ];

// // Binance WS for crypto
// function createBinanceWs(symbols: string[], onUpdate: (updates: any[]) => void) {
//   const streamNames = symbols.map(s => s.toLowerCase() + '@ticker').join('/');
//   const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streamNames}`);

//   ws.onmessage = (event) => {
//     const data = JSON.parse(event.data)?.data;
//     if (!data) return;

//     const update = {
//       symbol: data.s,
//       price: parseFloat(data.c),
//       change: parseFloat(data.p),
//     };

//     onUpdate([update]);
//   };

//   ws.onerror = (e) => console.error('Binance WS error:', e);
//   ws.onclose = () => console.log('Binance WS closed');

//   return ws;
// }

// export default function Home() {
//   const [stocks, setStocks] = useState<any[]>([]);
//   const [crypto, setCrypto] = useState<any[]>(mockCrypto);

//   // Fetch stock data from API
//   useEffect(() => {
//     const fetchStocks = async () => {
//       try {
//         const res = await fetch('/api/stocks');
//         const data = await res.json();
//         setStocks(data);
//       } catch (err) {
//         console.error('Stock fetch error:', err);
//       }
//     };

//     fetchStocks();
//     const interval = setInterval(fetchStocks, 15000); // Refresh every 15s
//     return () => clearInterval(interval);
//   }, []);

//   // Binance WS for crypto live updates
//   useEffect(() => {
//     const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT"];
//     const ws = createBinanceWs(symbols, (updates) => {
//       setCrypto((prev) => {
//         const updated = [...prev];
//         updates.forEach(u => {
//           const idx = updated.findIndex(c => c.symbol === u.symbol);
//           if (idx !== -1) updated[idx] = u;
//         });
//         return updated;
//       });
//     });

//     return () => ws.close();
//   }, []);

//   const tickerData = [...stocks, ...crypto];

//   const features = [
//     {
//       icon: TrendingUp,
//       title: 'Stock Market Analytics',
//       description: 'Real-time data, technical indicators, and AI-powered predictions for equities.',
//       link: '/markets/stock',
//       gradient: 'from-blue-500 to-cyan-500',
//     },
//     {
//       icon: Globe,
//       title: 'Cryptocurrency Intelligence',
//       description: 'Track top cryptocurrencies with sentiment analysis and price forecasting.',
//       link: '/markets/crypto',
//       gradient: 'from-purple-500 to-pink-500',
//     },
//     {
//       icon: BarChart3,
//       title: 'E-commerce Insights',
//       description: 'Product analytics, fake review detection, and pricing intelligence.',
//       link: '/markets/ecommerce',
//       gradient: 'from-orange-500 to-red-500',
//     },
//   ];

//   const capabilities = [
//     { icon: Brain, title: 'AI-Powered Predictions', description: 'LSTM model for accurate future price forecasting' },
//     { icon: Shield, title: 'Sentiment Analysis', description: 'Real-time social media and news sentiment tracking' },
//     { icon: Zap, title: 'Real-Time Data', description: 'Live market updates every 10 seconds' },
//   ];

//   return (
//     <div className="min-h-screen">
//       {/* Hero Section */}
//       <section className="relative overflow-hidden gradient-hero py-20 md:py-32">
//         <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
//         <div className="container mx-auto px-4 relative z-10 text-center">
//           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
//             <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
//               <span className="relative flex h-2 w-2">
//                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
//                 <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
//               </span>
//               <span className="text-sm font-medium">Live Market Data</span>
//             </div>

//             <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
//               Real-time Market Intelligence &{' '}
//               <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
//                 Predictive Analytics
//               </span>
//             </h1>

//             <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto">
//               Professional-grade analytics for stocks, crypto, and e-commerce with AI-powered forecasting
//             </p>

//             <div className="flex flex-col sm:flex-row gap-4 justify-center">
//               <Link href="/markets/stock">
//                 <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8">
//                   Explore Markets
//                 </Button>
//               </Link>
//               <Link href="/about">
//                 <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-lg px-8">
//                   Learn More
//                 </Button>
//               </Link>
//             </div>
//           </motion.div>
//         </div>
//       </section>

//       {/* Live Ticker */}
//       <div className="bg-card/50 border-y border-border/40 backdrop-blur-sm py-4 overflow-hidden">
//         <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="flex space-x-8 whitespace-nowrap">
//           {[...tickerData, ...tickerData].map((item, idx) => (
//             <div key={idx} className="flex items-center space-x-2">
//               <span className="font-semibold">{item.symbol}</span>
//               <span className="text-foreground/70">${item.price.toFixed(2)}</span>
//               <span className={item.change >= 0 ? 'text-success' : 'text-destructive'}>
//                 {item.change >= 0 ? '+' : ''}
//                 {item.change.toFixed(2)}
//               </span>
//             </div>
//           ))}
//         </motion.div>
//       </div>

//       {/* Features Grid */}
//       <section className="py-20">
//         <div className="container mx-auto px-4">
//           <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
//             <h2 className="text-3xl md:text-4xl font-bold mb-4">Multi-Market Intelligence</h2>
//             <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
//               Comprehensive analytics across multiple asset classes and platforms
//             </p>
//           </motion.div>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//             {features.map((feature, idx) => (
//               <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}>
//               <Link href={feature.link}>
//                 <Card className="glass hover:glow-primary transition-all duration-300 cursor-pointer h-full group">
//                   <CardContent className="p-6">
//                     <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
//                       <feature.icon className="h-6 w-6 text-white" />
//                     </div>
//                     <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
//                     <p className="text-muted-foreground">{feature.description}</p>
//                   </CardContent>
//                 </Card>
//               </Link>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* Capabilities */}
//       <section className="py-20 bg-muted/30">
//         <div className="container mx-auto px-4">
//           <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
//             <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced Capabilities</h2>
//             <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
//               Powered by cutting-edge machine learning and real-time data processing
//             </p>
//           </motion.div>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
//             {capabilities.map((cap, idx) => (
//               <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }} className="text-center">
//                 <div className="w-16 h-16 rounded-2xl bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
//                   <cap.icon className="h-8 w-8 text-white" />
//                 </div>
//                 <h3 className="text-xl font-semibold mb-2">{cap.title}</h3>
//                 <p className="text-muted-foreground">{cap.description}</p>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* CTA Section */}
//       <section className="py-20">
//         <div className="container mx-auto px-4">
//           <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto glow-primary">
//             <h2 className="text-3xl md:text-4xl font-bold mb-4">
//               Ready to Transform Your Trading Strategy?
//             </h2>
//             <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
//               Join thousands of traders using AI Driven Market Analysis for data-driven decisions
//             </p>
//             <Link href="/markets/stock">
//               <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8">
//                 Get Started Now
//               </Button>
//             </Link>
//           </motion.div>
//         </div>
//       </section>
//     </div>
//   );
// }




'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, BarChart3, Brain, Shield, Zap, Globe } from 'lucide-react';

// Helper: Binance WebSocket with auto-reconnect
function createBinanceWs(symbols: string[], onUpdate: (updates: any[]) => void) {
  let ws: WebSocket | null = null;
  let reconnectTimeout = 2000;

  const connect = () => {
    const streamNames = symbols.map(s => s.toLowerCase() + '@ticker').join('/');
    ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streamNames}`);

    ws.onopen = () => {
      console.log('Binance WS connected');
      reconnectTimeout = 2000;
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)?.data;
      if (!data) return;

      const update = {
        symbol: data.s,
        price: parseFloat(data.c),
        change: parseFloat(data.p),
      };

      onUpdate([update]);
    };

    // ws.onerror = (event: Event) => {
    //   console.error('Binance WS error:', event);
    // };
    ws.onerror = () => {};


    ws.onclose = (event) => {
      console.warn('Binance WS closed, reconnecting...', event.reason || 'no reason');
      ws = null;
      setTimeout(connect, reconnectTimeout);
      reconnectTimeout = Math.min(reconnectTimeout * 2, 60000);
    };
  };

  connect();

  return () => ws?.close();
}

export default function Home() {
  const STOCK_SYMBOLS = ["AAPL","GOOG","AMZN","TSLA","NVDA"];
  const CRYPTO_SYMBOLS = ["BTCUSDT","ETHUSDT","BNBUSDT"];

  const [tickerData, setTickerData] = useState<any[]>([]);

  // Fetch Yahoo Stocks API
  const fetchStockPrices = async () => {
    try {
      const res = await fetch('/api/stocks');
      const stocks = await res.json();
      setTickerData((prev) => {
        // Merge with existing crypto data
        const cryptoOnly = prev.filter(item => CRYPTO_SYMBOLS.includes(item.symbol));
        return [...stocks, ...cryptoOnly];
      });
    } catch (err) {
      console.error('stocks API error:', err);
    }
  };

  useEffect(() => {
    fetchStockPrices();
    const interval = setInterval(fetchStockPrices, 30000); // refresh every 30s

    // Setup Binance WS for crypto
    const cleanupWs = createBinanceWs(CRYPTO_SYMBOLS, (updates) => {
      setTickerData((prev) => {
        const updated = [...prev];
        updates.forEach((upd) => {
          const idx = updated.findIndex(item => item.symbol === upd.symbol);
          if (idx !== -1) updated[idx] = upd;
          else updated.push(upd);
        });
        return updated;
      });
    });

    return () => {
      clearInterval(interval);
      cleanupWs();
    };
  }, []);

  const features = [
    { icon: TrendingUp, title: 'Stock Market Analytics', description: 'Real-time data, technical indicators, and AI-powered predictions for equities.', link: '/markets/stock', gradient: 'from-blue-500 to-cyan-500' },
    { icon: Globe, title: 'Cryptocurrency Intelligence', description: 'Track top cryptocurrencies with sentiment analysis and price forecasting.', link: '/markets/crypto', gradient: 'from-purple-500 to-pink-500' },
    { icon: BarChart3, title: 'E-commerce Insights', description: 'Product analytics, fake review detection, and pricing intelligence.', link: '/markets/ecommerce', gradient: 'from-orange-500 to-red-500' },
  ];

  const capabilities = [
    { icon: Brain, title: 'AI-Powered Predictions', description: 'LSTM model for accurate future price forecasting' },
    { icon: Shield, title: 'Sentiment Analysis', description: 'Real-time social media and news sentiment tracking' },
    { icon: Zap, title: 'Real-Time Data', description: 'Live market updates every 10 seconds' },
  ];

  return (
    <div className="min-h-screen">

      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero py-20 md:py-32">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-sm font-medium">Live Market Data</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Real-time Market Intelligence & <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Predictive Analytics</span>
            </h1>
            <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto">
              Professional-grade analytics for stocks, crypto, and e-commerce with AI-powered forecasting
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/markets/stock"><Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8">Explore Markets</Button></Link>
              <Link href="/about"><Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10 text-lg px-8">Learn More</Button></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Ticker */}
      <div className="bg-card/50 border-y border-border/40 backdrop-blur-sm py-4 overflow-hidden">
        <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="flex space-x-8 whitespace-nowrap">
          {[...tickerData, ...tickerData].map((item, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <span className="font-semibold">{item.symbol}</span>
              <span className="text-foreground/70">${item.price?.toFixed(2)}</span>
              <span className={item.change >= 0 ? 'text-success' : 'text-destructive'}>
                {item.change >= 0 ? '+' : ''}{item.change?.toFixed(2)}
              </span>
            </div>
          ))}
        </motion.div>
      </div>


      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Multi-Market Intelligence</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive analytics across multiple asset classes and platforms
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}>
                <Link href={feature.link}>
                  <Card className="glass hover:glow-primary transition-all duration-300 cursor-pointer h-full group">
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <feature.icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                    
                  </Card>
                </Link>
                
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced Capabilities</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powered by cutting-edge machine learning and real-time data processing
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {capabilities.map((cap, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
                  <cap.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{cap.title}</h3>
                <p className="text-muted-foreground">{cap.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

       {/* CTA Section */}
       <section className="py-20">
         <div className="container mx-auto px-4">
           <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="glass rounded-3xl p-12 text-center max-w-4xl mx-auto glow-primary">
             <h2 className="text-3xl md:text-4xl font-bold mb-4">
               Ready to Transform Your Trading Strategy?
             </h2>
             <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of traders using AI Driven Market Analysis for data-driven decisions
             </p>
             <Link href="/markets/stock">
               <Button size="lg" className="gradient-primary text-white hover:opacity-90 transition-opacity text-lg px-8">
                 Get Started Now
               </Button>
             </Link>
           </motion.div>
         </div>
       </section>

    </div>
  );
}
