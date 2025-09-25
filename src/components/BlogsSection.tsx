import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Blog } from "@/types/Blogs"
import { ArrowRight } from "lucide-react"

export default function BlogSection() {
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/data/blogsData.json")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok")
        return res.json()
      })
      .then((data: Blog[]) => {
        setBlogs(data || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch blog:", err)
        setLoading(false)
      })
  }, [])

  const slides = useMemo(() => {
    if (!blogs?.length) return []
    const MIN_SLIDES = 6 // at least 2 full rotations on lg (3 per view)
    const target = Math.max(MIN_SLIDES, blogs.length)
    return Array.from({ length: target }, (_, i) => blogs[i % blogs.length])
  }, [blogs])

  if (loading) {
    return <p className="text-center text-gray-500">Loading blogs...</p>
  }
  if (!blogs || blogs.length === 0) {
    return <p className="text-center text-gray-500">No blogs available</p>
  }

  return (
    <div className="relative w-full md:max-w-6xl px-5 md:px-0 mx-auto py-12">
      <div className="flex flex-row items-center justify-between mb-12 space-y-0">
        <h2 className="text-3xl md:text-4xl font-display font-bold max-w-sm md:max-w-xl tracking-tight">
          Latest <span className="text-primary">Insights</span>
        </h2>
        <a
          href="/developers/articles"
          className="text-primary font-semibold flex items-center gap-1 hover:underline"
        >
          View all articles <ArrowRight className="w-5 h-5" />
        </a>
      </div>
      <div className="md:hidden flex items-center justify-end mb-4 text-sm text-gray-500 animate-bounce">
        Swipe →
      </div>

      <Carousel opts={{ align: "start", loop: true }}>
        <CarouselContent className="">
          {slides.map((blog, index) => (
            <CarouselItem
              key={`${blog.slug}-dup-${index}`}
              className="md:basis-1/2 lg:basis-1/3"
            >
              <Link
                to={`/developers${blog.slug}`} 
                className="block h-full group focus:outline-none py-2"
                aria-label={`Read blog: ${blog.title}`}
              >
                <Card className="h-full rounded-2xl shadow-md overflow-hidden flex flex-col transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-xl">
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={blog.image || `https://picsum.photos/seed/${index}/600/400`}
                      alt={blog.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 group-hover:ring-primary/20" />
                  </div>

                  <CardHeader className="space-y-1">
                    <CardTitle className="line-clamp-2">{blog.title}</CardTitle>
                    <p className="text-sm text-gray-500">{blog.date}</p>
                  </CardHeader>

                  {/* Description */}
                  <CardContent className="flex-1">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {blog.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Controls */}
        <div className="hidden md:flex justify-between mt-4">
          <CarouselPrevious className="btn" />
          <CarouselNext className="btn" />
        </div>
      </Carousel>
    </div>
  )
}