select date_trunc('month', ordered_at) as month,
       sum(amount_twd) as revenue
from orders_clean
group by 1
order by 1;
