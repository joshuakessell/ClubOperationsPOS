const InventoryPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Inventory
      </h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">
          Room and locker inventory status board will be displayed here.
        </p>
      </div>
    </div>
  );
};

export default InventoryPage;
