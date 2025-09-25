import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code } from 'lucide-react';

const InteractiveDemo = () => {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      <div className="content-grid">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
          <span className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary mb-3">
            Flexible API
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-4">
            Build with your favorite stack
          </h2>
          <p className="text-gray-800 text-lg">
            Our headless CMS works with any framework or platform. Get your content through our powerful API.
          </p>
        </div>

        <div className="relative rounded-xl border shadow-sm overflow-hidden bg-card animate-scale-in">
          <Tabs defaultValue="rest" className="w-full">
            <div className="border-b">
              <div className="px-4">
                <TabsList className="h-12">
                  <TabsTrigger value="rest" className="data-[state=active]:bg-transparent">
                    <div className="flex items-center">
                      <Code size={16} className="mr-2" />
                      REST API
                    </div>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            
            <TabsContent value="rest" className="mt-0">
              <div className="px-4 pt-4 bg-muted/30 text-sm font-mono rounded-b-lg">
                <div className="mb-2 text-gray-800">// Fetch content using REST API</div>
                <div className="bg-background rounded-md p-4 overflow-auto">
                  <pre className="text-xs md:text-sm">
{`fetch(\`https://client.vivreal.io/tenant/collectionObjects?collectionId=\${collectionId}\`, {
  method: 'GET', 
  headers: {
    'Authorization': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`}
                  </pre>
                </div>
                <div className="my-4 text-gray-800">// Response</div>
                <div className="bg-background rounded-md p-4 overflow-auto mb-4">
                  <pre className="text-xs md:text-sm">
{`{
  "collectionObj": {
    "name": "Products",
    "refID": "671999997777e8ed5911113e"
  },
  "author": {
    "name": "John Smith",
    "email": "jsmith@example.com"
  },
  "_id": "671999997777e8ed5911113e",
  "groupID": "671999997777e8ed5911113e",
  "archived": false,
  "objectValue": {
    "_id": "671999997777e8ed5911113e",
    "createdAt": "2024-10-25T04:32:06.113Z",
    "updatedAt": "2024-10-25T04:32:06.113Z",
    "productName": "Denim Jeans",
    "price": "52.99",
    "description": "Blue denim jeans"
  },
  "createdAt": "2024-10-25T04:21:26.689Z",
  "updatedAt": "2024-10-25T04:32:06.113Z",
  "__v": 0,
  "integrationInfo": {
    "_id": "671999997777e8ed5911113e",
    "createdAt": "2024-10-25T04:32:06.113Z",
    "updatedAt": "2024-10-25T04:32:06.113Z"
    }
  }
}`}
                  </pre>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="text-center mt-10">
          <a href="https://docs.vivreal.io/" target="_blank" className="text-primary hover:underline transition-colors">
            <Button variant="outline" className="font-medium">
              Explore the API documentation
            </Button>
          </a>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute -z-10 top-1/2 -translate-y-1/2 -right-20 h-96 w-96 bg-primary/5 rounded-full blur-3xl"></div>
    </section>
  );
};

export default InteractiveDemo;
