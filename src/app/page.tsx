import BurritoOrderForm from '@/components/burrito-order-form';

export default function Home() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      {/* Burrito of the Week title removed from here */}
      <BurritoOrderForm />
    </main>
  );
}
