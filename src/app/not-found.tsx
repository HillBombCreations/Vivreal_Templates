import Head from "next/head";
import Link from "next/link";
const NotFound = () => {

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Head>
        <title>404 Not Found</title>
        <meta name="description" content="Sorry, the page you are looking for does not exist. Return to our homepage to explore our features and solutions." />
      </Head>
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <Link href="/" className="text-blue-700 hover:text-blue-700 underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
