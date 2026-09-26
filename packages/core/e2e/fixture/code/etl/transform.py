TEST_ACCOUNTS = {"qa-1", "qa-2"}


def clean_orders(df, rates):
    """Drop test accounts, convert to TWD, merge resubmitted orders."""
    df = df[~df["account_id"].isin(TEST_ACCOUNTS)]

    # Convert at the rate of the day the order was placed.
    df["amount_twd"] = df.apply(
        lambda r: r.amount * rates[(r.currency, r.ordered_at.date())],
        axis=1,
    )

    # A resubmitted order keeps only its latest update.
    df = df.sort_values("updated_at").drop_duplicates("order_id", keep="last")
    return df
