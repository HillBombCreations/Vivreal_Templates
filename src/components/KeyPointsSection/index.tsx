"use client";

import React from "react"
import { CheckCircle } from "lucide-react"

const KeyPointsSection = () => {
  const points = [
    {
      title: "Competitive Pricing",
      description:
        "Get enterprise-grade features at a fraction of the cost. Transparent plans that scale with your business.",
    },
    {
      title: "Community Driven",
      description:
        "We listen to our users. Features and improvements are shaped by real community feedback.",
    },
    {
      title: "Scheduled Posting",
      description:
        "Plan and automate your content releases so your team stays ahead without last-minute stress.",
    },
    {
      title: "Developer Friendly",
      description:
        "Free up developers to focus on what matters. Our platform makes collaboration seamless across teams.",
    },
  ]

  return (
    <section className="from-white to-gray-50">
      <div className="content-grid text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-12">
          Why Choose Our CMS?
        </h2>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {points.map((point, index) => (
            <div
              key={index}
              className="p-6 bg-white rounded-2xl shadow-sm border hover:shadow-md transition-all"
            >
              <CheckCircle className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{point.title}</h3>
              <p className="text-sm text-gray-800">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default KeyPointsSection