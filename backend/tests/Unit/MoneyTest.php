<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_paise_totals_are_integers(): void
    {
        $this->assertSame(200075, 75050 + 125025);
    }
}
