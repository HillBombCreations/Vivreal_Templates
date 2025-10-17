export const siteData = {
  "primary": "#001a4a",
  "secondary": "#4A6FB8",
  "hover": "#2A4473",
  "surface": "#F6F8FC",
  "surface-alt": "#ffffff",
  "text-primary": "#001a4a",
  "text-secondary": "#5C6E88",
  "text-inverse": "#FFFFFF",
  "logo": {
    "name": "comedycollectiveLogo.png",
    "key": "groupObjects/68bfac783bc7c024975c90cb/1757391992521/comedycollectiveLogo.png",
    "type": "image",
    "currentFile": {
      "source": "/comedycollectiveLogo.png"
    }
  },
  "businessInfo": {
    "address": {
      "street1": "123 Easy St.",
      "street2": "",
      "city": "Example",
      "state": "EX",
      "zip": "00000"
    },
    "contactInfo": {
      "email": "example@email.com",
      "phoneNumber": ""
    },
    "name": "The Comedy Collective",
    "shipping": false
  },
  "domainName": "vivreal.io",
  "pages": {
    "landing-hero": "horizontal",
    "landing-carousel": "horizontal"
  },
  "siteMap": [
    {
      url: 'https://vivreal.io',
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 1.0,
    },
    {
      url: 'https://vivreal.io/what-we-do',
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    },
    {
      url: 'https://vivreal.io/about',
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: 'https://vivreal.io/media-hub',
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: 'https://vivreal.io/contact',
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    },
    {
      url: 'https://vivreal.io/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    },
    {
      url: 'https://vivreal.io/terms',
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    },
  ]
}

export const heroSectionData = {
  "title": "Scale Your Business/Not Your Budget",
  "subtitle": "A modern content management platform to create, edit, and publish content everywhere easy for teams, built to scale with you.",
  "button": {
    "size": "",
    "link": "#",
    "text": "Create Your Free Account",
    "color": "#22C55E",
    "subtext": "No credit card required. Ever."
  },
  "heroImage": {
    "name": "comedycollectiveLogo.png",
    "key": "groupObjects/68bfac783bc7c024975c90cb/1757391992521/comedycollectiveLogo.png",
    "type": "image",
    "source": "/comedycollectiveLogo.png"
  },
  "dataPoints": [
    {
      "title": "Competitive Pricing",
      "description": "Premium features at a fraction of the cost. Transparent plans that scale with your business.",
      "iconString": "PiggyBank",
      "color": "#15803D"
    },
    {
      "title": "Community Driven",
      "description": "We listen to our users. Features and improvements are shaped by real community feedback.",
      "iconString": "Handshake",
      "color": "#1D4ED8"
    },
    {
      "title": "Scheduled Posting",
      "description": "Plan and automate content releases so your team stays ahead without last-minute stress.",
      "iconString": "CalendarClock",
      "color": "#6D28D9"
    },
    {
      "title": "Developer Friendly",
      "description": "Free up developers to focus on what matters. Collaboration becomes seamless across teams.",
      "iconString": "Code",
      "color": "#B91C1C"
    }
  ]
};

export const featureGifSectionData = {
  "title": "Platform Poopers",
  "subtitle": "Powerful tools to streamline your workflow and scale operations.",
  "features": [
    {
      id: "quick-updates",
      title: "Quick Updates",
      iconString: "Clock",
      color: '#1D4ED8',
      description:
        "Make changes to your site in seconds. With Vivreal, updating your content is fast, intuitive, and doesn't require a developer just click, update, and publish.",
      gif: "/quickUpdatesV2.mp4",
      path: "/features/quick-updates"
      
    },
    {
      id: "easy-scheduling",
      title: "Easy Scheduling",
      iconString: "Calendar",
      color: '#6D28D9',
      description:
        "Plan and control when your content goes live with built-in scheduling. Use a simple calendar interface to automate publishing and stay organized with upcoming updates.",
      gif: "/easyScheduling.mp4",
      path: "/features/easy-scheduling"
    },
    {
      id: "data-analytics",
      title: "Data Analytics",
      iconString: "BarChart2",
      color: '#B91C1C',
      description:
        "Get a clear overview of how your team is using Vivreal. Track Vivrecords created, objects added, media uploaded, group users, active integrations, and more all from one dashboard.",
      gif: "/dataAnalytics.mp4",
      path: "/features/data-analytics"
    },
    {
      id: "order-analytics",
      title: "Order Analytics",
      iconString: "ClipboardList",
      color: '#15803D',
      description:
        "If you're using the Stripe integration, monitor your store's performance with detailed order analytics. View sales trends, top products, revenue over time, and gain insights to grow your business.",
      gif: "/orderAnalytics.mp4",
      path: "/features/order-analytics"
    }
  ]
};

export const whatWeDoSectionData = {
  "title": "From questions to solutions we make it happen together.",
  "features": [
    {
      iconString: "ShieldCheck",
      title: "Reliable Support",
      description:
        "Our team is here around the clock to tackle any challenge, minimize downtime, and ensure your business runs seamlessly.",
    },
    {
      iconString: "Users",
      title: "Success Partnership",
      description:
        "You're never alone. Our dedicated team partners with you, providing proactive support and personalized training to help you thrive.",
    },
    {
      iconString: "MessageSquare",
      title: "Build With You",
      description:
        "We listen. Your community feedback shapes our roadmap so we build the tools you actually need to grow and succeed.",
    },
  ]
};

export const solutionsSectionData = {
  "title": "Solutions built for scale enabling your team to move faster and smarter.",
  "linkText": "Explore solutions",
  "solutions": [
    {
      id: "fast-api",
      title: "Blazing Speed Delivery",
      description:
        "Ensure your content reaches your audience instantly, keeping your business agile and responsive to market demands.",
      iconString: "Zap",
    },
    {
      id: "team-collab",
      title: "Seamless Teamwork",
      description:
        "Break down silos with tools that keep marketing, development, and editorial teams aligned and efficient.",
      iconString: "Users",
    },
    {
      id: "scalable-infra",
      title: "Effortless Growth",
      description:
        "Scale your content infrastructure effortlessly as your business expands, ensuring consistent performance at every stage.",
      iconString: "Server",
    },
    {
      id: "advanced-security",
      title: "Rock-Solid Security",
      description:
        "Protect your data and content with enterprise-grade security protocols designed to safeguard your business continuity.",
      iconString: "ShieldCheck",
    },
  ]
};

export const navigationLinks = [
  {
    "path": "/",
    "label": "Home",
    "displayOnHeader": true,
  },
  {
    "path": "/about",
    "label": "About",
    "displayOnHeader": true,
  },
];

export const articlesSectionData = {
  "title": "Latest Insights",
  "linkText": "View all",
  "linkSlug": "/media-hub",
  "mobileLabel": "Swipe →",
  "loadingMessage": "Loading placeholder...",
  "noDataMessage": "No placeholder available",
  "type": "Article"
};