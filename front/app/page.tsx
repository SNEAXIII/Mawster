export default function Page() {
  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='text-center'>
        <h1 className='text-5xl font-bold text-gray-900 mb-4'>Mawster</h1>
        <div className='inline-block rounded-full bg-amber-100 px-6 py-2 mb-6'>
          <span className='text-amber-800 font-semibold text-lg'>🚧 Work in Progress</span>
        </div>
        <p className='text-gray-500 text-lg max-w-md mx-auto'>
          L&apos;application est en cours de développement. Revenez bientôt !
        </p>
      </div>
    </div>
  );
}
