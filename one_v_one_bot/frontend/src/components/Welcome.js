import Image from "next/image";

const Welcome = () => {
  return (
    <section className="bg-white dark:bg-gray-900">
      <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
        <div className="mr-auto place-self-center lg:col-span-7">
          <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white">
            Welcome to One vs One
          </h1>
          <p className="max-w-2xl mb-6 font-light text-gray-500 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400">
            Manage your gaming tournaments with ease. Create, organize, and
            track your events all in one place.
          </p>
        </div>
        <div className="hidden lg:mt-0 lg:col-span-5 lg:flex">
          {/* Using next/image for optimized image handling */}
          <Image
            src="/gaming_tournament.webp"
            alt="Gaming Tournament"
            width={500} // Adjust width as needed
            height={300} // Adjust height as needed
            layout="responsive" // This can be adjusted based on your design needs
          />
        </div>
      </div>
    </section>
  );
};

export default Welcome;
