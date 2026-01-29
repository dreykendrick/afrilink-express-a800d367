import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { City, SameCityZone, CrossCityFee } from '@/lib/types';

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching cities:', error);
        throw error;
      }

      return data as City[];
    },
  });
}

export function useSameCityZones(cityId: string | null) {
  return useQuery({
    queryKey: ['same_city_zones', cityId],
    queryFn: async () => {
      if (!cityId) return [];

      const { data, error } = await supabase
        .from('same_city_zones')
        .select('*')
        .eq('city_id', cityId)
        .order('zone_name');

      if (error) {
        console.error('Error fetching zones:', error);
        throw error;
      }

      return data as SameCityZone[];
    },
    enabled: !!cityId,
  });
}

export function useCrossCityFee(fromCityId: string | null, toCityId: string | null) {
  return useQuery({
    queryKey: ['cross_city_fee', fromCityId, toCityId],
    queryFn: async () => {
      if (!fromCityId || !toCityId || fromCityId === toCityId) return null;

      const { data, error } = await supabase
        .from('cross_city_fees')
        .select('*')
        .eq('from_city_id', fromCityId)
        .eq('to_city_id', toCityId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cross-city fee:', error);
        throw error;
      }

      return data as CrossCityFee | null;
    },
    enabled: !!fromCityId && !!toCityId && fromCityId !== toCityId,
  });
}
