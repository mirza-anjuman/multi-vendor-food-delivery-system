import HowItWorksSection from '@/components/HowItWorksSection';
import JoinFoodRushSection from '@/components/JoinFoodRushSection';
import NearbyRestaurants from '@/components/NearbyRestaurants';
import NewHeroSection from '@/components/NewHeroSection';
import PopularRestaurants from '@/components/PopularRestaurants';
import ReviewsAndRatings from '@/components/ReviewsAndRatings';
import TopFoodCategories from '@/components/TopFoodCategories';
import React, { useCallback, useState } from 'react';

const NewHomePage: React.FC = () => {
  const [nearbyIds, setNearbyIds] = useState<string[]>([]);

  const handleNearbyLoaded = useCallback((ids: string[]) => {
    setNearbyIds(ids);
  }, []);

  return (
    <>
      <NewHeroSection />
      <TopFoodCategories />
      <NearbyRestaurants onLoadedIds={handleNearbyLoaded} />
      <PopularRestaurants excludeIds={nearbyIds} />
      <HowItWorksSection />
      <ReviewsAndRatings />
      <JoinFoodRushSection />
    </>
  );
};

export default NewHomePage;
