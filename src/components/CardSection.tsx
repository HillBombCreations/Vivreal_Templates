import { useState, FC, useEffect } from "react"
import { Lightbulb, Target, Handshake } from "lucide-react"

export type CardData = {
  id: string
  icon: "lightBulb" | "target" | "heart"
  title: string
  description: string
  imageSource: string
}

const CardSection: FC = () => {
  const [cardSectionData, setCardSectionData] = useState<CardData[]>([])
  const [selectedCard, setSelectedCard] = useState<CardData>()
  const [siteData, setSiteData] = useState<Record<string, string> | null>(null)
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)

  const iconDict: Record<CardData["icon"], JSX.Element> = {
    lightBulb: <Lightbulb className="w-6 h-6" />,
    target: <Target className="w-6 h-6" />,
    heart: <Handshake className="w-6 h-6" />,
  }

  useEffect(() => {
    fetch("/data/cardData.json")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok")
        return res.json()
      })
      .then((data: CardData[]) => {
        setCardSectionData(data || [])
        setSelectedCard(data[0])
      })
      .catch((err) => {
        console.error("Failed to fetch cards:", err)
      })

    fetch("/data/siteData.json")
      .then((res) => res.json())
      .then((data) => {
        setSiteData(data)
      })
      .catch((err) => {
        console.error("Failed to load site data:", err)
      })
  }, [])

  return (
    <section className="w-full bg-muted py-16 px-6 md:px-20 flex flex-col items-center gap-16">
      <div className="flex flex-col items-center lg:flex-row w-full max-w-7xl gap-8">
        <div className="w-full lg:w-2/5 flex flex-col gap-4">
          {cardSectionData.map((card) => {
            const isSelected = selectedCard?.id === card.id
            const isHovered = hoveredCardId === card.id
            const background =
              isSelected || isHovered
                ? siteData?.primary
                : siteData?.["surface-alt"] || "#fff"
            const textColor =
              isSelected || isHovered
                ? siteData?.["text-inverse"]
                : siteData?.["text-primary"] || "#000"
            const borderColor =
              isSelected || isHovered
                ? siteData?.primary
                : siteData?.border || "#e5e7eb"

            return (
              <div
                key={card.id}
                onClick={() => setSelectedCard(card)}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  background,
                  color: textColor,
                  borderColor,
                  borderWidth: "1px",
                  borderStyle: "solid",
                }}
                className="flex items-start gap-4 p-6 rounded-lg cursor-pointer transition-all shadow-md"
              >
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: textColor }}
                >
                  {iconDict[card.icon]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="text-sm mt-1">{card.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="w-full lg:w-3/5 flex items-center justify-center min-h-[60vh] animate-fade-in">
          {selectedCard && (
            <img
              src={selectedCard.imageSource}
              alt={selectedCard.title}
              className="w-full max-w-xl max-h-[500px] object-contain rounded-lg shadow-md"
            />
          )}
        </div>
      </div>
    </section>
  )
}

export default CardSection