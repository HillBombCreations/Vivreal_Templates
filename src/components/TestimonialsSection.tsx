import TestimonialCard from './TestimonialCard';

const TestimonialsSection = () => {
  const testimonials = [
    {
      content: "They were able to ask me all of the right questions to help me create exactly what was in my head this whole time.",
      name: "Will C",
      role: "Creative Director"
    },
    {
      content: "They exceeded our expectations and went above and beyond to ensure all of our needs were met. Their pricing was very reasonable for the value that was provided. I would definitely recommend this business!",
      name: "Hunter K",
      role: "Business Owner"
    }
  ];

  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      <div className="content-grid">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
          <span className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary mb-3">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-4">
            Trusted by <span className="text-primary">industry leaders</span>
          </h2>
          <p className="text-gray-800 text-lg">
            See what our customers have to say about how Vivreal has transformed their content strategy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              content={testimonial.content}
              name={testimonial.name}
              role={testimonial.role}
              delay={100 * (index + 1)}
            />
          ))}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -z-10 bottom-40 left-20 h-64 w-64 bg-primary/5 rounded-full blur-3xl"></div>
    </section>
  );
};

export default TestimonialsSection;
